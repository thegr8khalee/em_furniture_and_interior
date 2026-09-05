import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { logger } from '../lib/logger.js';

/**
 * The audit and activity logs, against PostgreSQL.
 *
 * Two append-only records: what an operator did, and what a shopper did.
 *
 * `audit_logs.actor_email` is denormalised on purpose. An audit entry has to
 * stay readable after the account it names is deleted, and a trail that says
 * "null did this" is not a trail. The activity log takes the opposite approach
 * for the same reason it can: `customer_id` is a real foreign key, so the top-
 * users report joins rather than looking accounts up in a second database.
 *
 * Neither write may ever fail the request that caused it. A logging failure
 * that turns a successful admin action into a 500 loses the action *and* the
 * record of it, which is worse than losing only the record.
 */

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/** An id worth recording: a UUID, or any other identifier as text. */
const asText = (value) => (value === undefined || value === null ? null : String(value));

const asJson = (value) =>
  value === undefined || value === null ? null : JSON.stringify(value);

/** `inet` refuses a malformed address, and a log entry is not worth losing over one. */
const asAddress = (value) => {
  const address = String(value ?? '').replace(/^::ffff:/, '');
  return /^[0-9a-f.:]+$/i.test(address) && address.length > 0 ? address : null;
};

const range = (startDate, endDate) => {
  const clauses = [];
  const replacements = {};

  if (startDate) {
    clauses.push('created_at >= :startDate');
    replacements.startDate = new Date(startDate);
  }
  if (endDate) {
    clauses.push('created_at <= :endDate');
    replacements.endDate = new Date(endDate);
  }

  return { clauses, replacements };
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

const publicAudit = (row) => ({
  _id: row.id,
  actor: row.actor_id
    ? { _id: row.actor_id, username: row.actor_username, email: row.actor_email }
    : null,
  actorEmail: row.actor_email,
  action: row.action,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  resourceName: row.resource_name,
  changes: row.changes,
  metadata: row.metadata,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  status: row.status,
  errorMessage: row.error_message,
  createdAt: row.created_at,
});

/** Never throws: a failed audit write is logged and the request continues. */
export const recordAudit = async (entry, db = getSequelize()) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_email, action, resource_type, resource_id,
                               resource_name, changes, metadata, ip_address, user_agent,
                               status, error_message)
       VALUES (:actorId, :actorEmail, :action::audit_action, :resourceType, :resourceId,
               :resourceName, :changes, :metadata, :ipAddress, :userAgent,
               :status::audit_outcome, :errorMessage)`,
      {
        replacements: {
          actorId: isValidId(String(entry.actorId ?? '')) ? entry.actorId : null,
          actorEmail: entry.actorEmail || 'unknown',
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: asText(entry.resourceId),
          resourceName: entry.resourceName ?? null,
          changes: asJson(entry.changes),
          metadata: asJson(entry.metadata),
          ipAddress: asAddress(entry.ipAddress),
          userAgent: entry.userAgent ?? null,
          status: entry.status || 'success',
          errorMessage: entry.errorMessage ?? null,
        },
      }
    );
  } catch (error) {
    logger.error({ err: error }, 'Could not write the audit log entry');
  }
};

export const listAuditLogs = async (filters = {}, db = getSequelize()) => {
  const { page = 1, limit = 50, action, resourceType, actor, status, startDate, endDate } = filters;

  const { clauses, replacements } = range(startDate, endDate);

  if (action) {
    clauses.push('a.action = :action::audit_action');
    replacements.action = action;
  }
  if (resourceType) {
    clauses.push('a.resource_type = :resourceType');
    replacements.resourceType = resourceType;
  }
  if (actor && isValidId(String(actor))) {
    clauses.push('a.actor_id = :actor');
    replacements.actor = actor;
  }
  if (status) {
    clauses.push('a.status = :status::audit_outcome');
    replacements.status = status;
  }

  const where = clauses.length
    ? `WHERE ${clauses.map((clause) => clause.replace(/^created_at/, 'a.created_at')).join(' AND ')}`
    : '';

  const rows = await select(
    db,
    `SELECT a.*, s.username AS actor_username FROM audit_logs a
       LEFT JOIN staff s ON s.id = a.actor_id
       ${where}
      ORDER BY a.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...replacements, limit, offset: (page - 1) * limit }
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM audit_logs a ${where}`,
    replacements
  );

  return { logs: rows.map(publicAudit), total: counted.total };
};

const countBy = async (db, table, column, where, replacements, extra = '') =>
  select(
    db,
    `SELECT ${column}::text AS _id, count(*)::int AS count ${extra}
       FROM ${table} ${where} GROUP BY ${column} ORDER BY count DESC`,
    replacements
  );

export const auditStats = async ({ startDate, endDate } = {}, db = getSequelize()) => {
  const { clauses, replacements } = range(startDate, endDate);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [byAction, byResource, byStatus, byActor] = await Promise.all([
    countBy(db, 'audit_logs', 'action', where, replacements),
    countBy(db, 'audit_logs', 'resource_type', where, replacements),
    countBy(db, 'audit_logs', 'status', where, replacements),
    select(
      db,
      `SELECT actor_id AS _id, actor_email AS "actorEmail", count(*)::int AS count
         FROM audit_logs ${where}
        GROUP BY actor_id, actor_email ORDER BY count DESC LIMIT 10`,
      replacements
    ),
  ]);

  return { byAction, byResource, byActor, byStatus };
};

export const purgeAuditLogs = async (daysToKeep = 90, db = getSequelize()) => {
  const days = Number.parseInt(daysToKeep, 10);
  if (!Number.isInteger(days) || days < 1) return { deletedCount: 0, days: null };

  const [, result] = await db.query(
    `DELETE FROM audit_logs WHERE created_at < now() - (:days || ' days')::interval`,
    { replacements: { days } }
  );

  return { deletedCount: result?.rowCount ?? 0, days };
};

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

const publicActivity = (row) => ({
  _id: row.id,
  user: row.customer_id
    ? { _id: row.customer_id, username: row.customer_name, email: row.customer_email }
    : null,
  guest: row.guest_session_id,
  activityType: row.activity_type,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  metadata: row.metadata,
  sessionId: row.session_id,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  referrer: row.referrer,
  page: row.page,
  createdAt: row.created_at,
});

/** Never throws, for the same reason `recordAudit` does not. */
export const recordActivity = async (entry, db = getSequelize()) => {
  try {
    await db.query(
      `INSERT INTO activity_logs (customer_id, guest_session_id, activity_type, resource_type,
                                  resource_id, metadata, session_id, ip_address, user_agent,
                                  referrer, page)
       VALUES (:customerId, :guestSessionId, :activityType, :resourceType,
               :resourceId, :metadata, :sessionId, :ipAddress, :userAgent,
               :referrer, :page)`,
      {
        replacements: {
          customerId: isValidId(String(entry.customerId ?? '')) ? entry.customerId : null,
          guestSessionId: isValidId(String(entry.guestSessionId ?? ''))
            ? entry.guestSessionId
            : null,
          activityType: entry.activityType,
          resourceType: entry.resourceType ?? null,
          resourceId: asText(entry.resourceId),
          metadata: asJson(entry.metadata),
          sessionId: entry.sessionId ?? null,
          ipAddress: asAddress(entry.ipAddress),
          userAgent: entry.userAgent ?? null,
          referrer: entry.referrer ?? null,
          page: entry.page ?? null,
        },
      }
    );
  } catch (error) {
    logger.error({ err: error }, 'Could not write the activity log entry');
  }
};

export const listActivityLogs = async (filters = {}, db = getSequelize()) => {
  const { page = 1, limit = 50, activityType, resourceType, userId, startDate, endDate } = filters;

  const { clauses, replacements } = range(startDate, endDate);

  if (activityType) {
    clauses.push('l.activity_type = :activityType');
    replacements.activityType = activityType;
  }
  if (resourceType) {
    clauses.push('l.resource_type = :resourceType');
    replacements.resourceType = resourceType;
  }
  if (userId && isValidId(String(userId))) {
    clauses.push('l.customer_id = :userId');
    replacements.userId = userId;
  }

  const where = clauses.length
    ? `WHERE ${clauses.map((clause) => clause.replace(/^created_at/, 'l.created_at')).join(' AND ')}`
    : '';

  const rows = await select(
    db,
    `SELECT l.*, c.full_name AS customer_name, c.email AS customer_email
       FROM activity_logs l
       LEFT JOIN customers c ON c.id = l.customer_id
       ${where}
      ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...replacements, limit, offset: (page - 1) * limit }
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM activity_logs l ${where}`,
    replacements
  );

  return { logs: rows.map(publicActivity), total: counted.total };
};

export const activityStats = async ({ startDate, endDate } = {}, db = getSequelize()) => {
  const { clauses, replacements } = range(startDate, endDate);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [byActivity, byResource, topUsers, byHour] = await Promise.all([
    countBy(db, 'activity_logs', 'activity_type', where, replacements),
    countBy(db, 'activity_logs', 'resource_type', where, replacements),
    // A join, where Mongo needed a `$lookup` into a collection in another
    // database — which is why this report showed "undefined undefined".
    select(
      db,
      // `created_at` is qualified here because `customers` has one too, and an
      // ambiguous column reference is a runtime error, not a warning.
      `SELECT l.customer_id AS "userId", c.full_name AS "userName", c.email,
              count(*)::int AS count
         FROM activity_logs l
         JOIN customers c ON c.id = l.customer_id
        WHERE ${[...clauses.map((clause) => `l.${clause}`), 'l.customer_id IS NOT NULL'].join(' AND ')}
        GROUP BY l.customer_id, c.full_name, c.email
        ORDER BY count DESC LIMIT 10`,
      replacements
    ),
    select(
      db,
      `SELECT extract(hour FROM created_at)::int AS _id, count(*)::int AS count
         FROM activity_logs ${where} GROUP BY 1 ORDER BY 1`,
      replacements
    ),
  ]);

  return { byActivity, byResource, topUsers, byHour };
};
