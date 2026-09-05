import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';

/**
 * Notifications and the loyalty ledger, against PostgreSQL.
 *
 * Both are per-customer histories, and both were Mongo collections referring to
 * accounts by an id nothing could join on.
 *
 * The loyalty table is a ledger, and the balance on `customers.loyalty_points`
 * is its total. Mongo wrote the two independently — the order handler
 * incremented the balance and separately created a transaction document — so a
 * balance could not be explained from its history, and a retried delivery could
 * pay the points twice. Awarding is one function now, in one transaction, and
 * `loyalty_one_earn_per_order` makes a second award for the same order
 * impossible rather than merely unlikely.
 */

export class EngagementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'EngagementError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const publicNotification = (row) => ({
  _id: row.id,
  user: row.customer_id,
  title: row.title,
  message: row.message,
  type: row.type,
  relatedOrder: row.order_id,
  isRead: row.is_read,
  readAt: row.read_at,
  createdAt: row.created_at,
});

const NOTIFICATION_COLUMNS =
  'id, customer_id, title, message, type, order_id, is_read, read_at, created_at';

/**
 * Tells a customer something.
 *
 * Returns null rather than throwing when there is nobody to tell — a guest
 * order has no account to notify, and that is ordinary, not a failure.
 */
export const notify = async (
  { customerId, title, message, type = 'system', orderId = null },
  db = getSequelize(),
  opts = {}
) => {
  if (!isValidId(String(customerId ?? ''))) return null;
  if (!title || !message) throw new EngagementError('A notification needs a title and a message.');

  const row = await selectOne(
    db,
    `INSERT INTO notifications (customer_id, title, message, type, order_id)
     VALUES (:customerId, :title, :message, :type::notification_type, :orderId)
     RETURNING ${NOTIFICATION_COLUMNS}`,
    { customerId, title, message, type, orderId },
    opts
  );

  return publicNotification(row);
};

export const listNotifications = async (
  customerId,
  { page = 1, limit = 20 } = {},
  db = getSequelize()
) => {
  const rows = await select(
    db,
    `SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE customer_id = :customerId
      ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { customerId, limit, offset: (page - 1) * limit }
  );

  const counts = await selectOne(
    db,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE NOT is_read)::int AS unread
       FROM notifications WHERE customer_id = :customerId`,
    { customerId }
  );

  return {
    notifications: rows.map(publicNotification),
    total: counts.total,
    unreadCount: counts.unread,
  };
};

/**
 * Marks one notification read.
 *
 * The customer is in the WHERE clause, not checked afterwards: one shopper
 * cannot mark another's notification read by guessing an id.
 */
export const markNotificationRead = async (customerId, notificationId, db = getSequelize()) => {
  if (!isValidId(String(notificationId ?? ''))) return null;

  const row = await selectOne(
    db,
    `UPDATE notifications SET is_read = true, read_at = now()
      WHERE id = :notificationId AND customer_id = :customerId
      RETURNING ${NOTIFICATION_COLUMNS}`,
    { notificationId, customerId }
  );

  return row ? publicNotification(row) : null;
};

export const markAllNotificationsRead = async (customerId, db = getSequelize()) => {
  const [, result] = await db.query(
    `UPDATE notifications SET is_read = true, read_at = now()
      WHERE customer_id = :customerId AND NOT is_read`,
    { replacements: { customerId } }
  );
  return result?.rowCount ?? 0;
};

export const deleteNotification = async (customerId, notificationId, db = getSequelize()) => {
  if (!isValidId(String(notificationId ?? ''))) return false;

  const [, result] = await db.query(
    'DELETE FROM notifications WHERE id = :notificationId AND customer_id = :customerId',
    { replacements: { notificationId, customerId } }
  );
  return (result?.rowCount ?? 0) > 0;
};

// ---------------------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------------------

const publicLoyalty = (row) => ({
  _id: row.id,
  user: row.customer_id,
  order: row.order_id,
  type: row.type,
  points: row.points,
  description: row.description,
  createdAt: row.created_at,
});

const LOYALTY_COLUMNS = 'id, customer_id, order_id, type, points, description, created_at';

/**
 * Moves a customer's points, and records why, together.
 *
 * The balance and the ledger line are written in one transaction, so the two
 * can never disagree — which they could under Mongo, where a failure between
 * the increment and the document left a balance nothing explained.
 *
 * Points are signed in the direction the balance moves;
 * `loyalty_direction_matches_type` refuses an "earn" that subtracts.
 */
export const applyLoyalty = async (
  db,
  { customerId, orderId = null, type, points, description = '' },
  opts = {}
) => {
  if (!isValidId(String(customerId ?? ''))) {
    throw new EngagementError('Loyalty points belong to an account.', 404);
  }

  const amount = Number(points);
  if (!Number.isInteger(amount) || amount === 0) {
    throw new EngagementError('Points must be a whole number, and not zero.');
  }

  const row = await selectOne(
    db,
    `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, description)
     VALUES (:customerId, :orderId, :type::loyalty_movement, :points, :description)
     RETURNING ${LOYALTY_COLUMNS}`,
    { customerId, orderId, type, points: amount, description },
    opts
  ).catch((error) => {
    const constraint = error?.original?.constraint;
    if (constraint === 'loyalty_direction_matches_type') {
      throw new EngagementError(`An ${type} cannot move points in that direction.`);
    }
    if (constraint === 'loyalty_one_earn_per_order') {
      throw new EngagementError('This order has already earned its points.', 409);
    }
    if (error?.original?.code === '22P02') {
      throw new EngagementError(`"${type}" is not a kind of loyalty movement.`);
    }
    throw error;
  });

  const balance = await selectOne(
    db,
    `UPDATE customers SET loyalty_points = loyalty_points + :points
      WHERE id = :customerId RETURNING loyalty_points`,
    { customerId, points: amount },
    opts
  ).catch((error) => {
    if (error?.original?.constraint === 'customers_loyalty_points_check') {
      throw new EngagementError('That would take the balance below zero.');
    }
    throw error;
  });

  return { transaction: publicLoyalty(row), balance: balance.loyalty_points };
};

/**
 * The same thing, in a transaction of its own.
 *
 * Callers that are already inside one — awarding points as part of delivering
 * an order — use `applyLoyalty` and pass theirs, so the points and the reason
 * for them commit with the event that caused them.
 */
export const recordLoyalty = (input, db = getSequelize()) =>
  db.transaction((transaction) => applyLoyalty(db, input, { transaction }));

export const loyaltyHistory = async (
  customerId,
  { page = 1, limit = 20 } = {},
  db = getSequelize()
) => {
  const rows = await select(
    db,
    `SELECT ${LOYALTY_COLUMNS} FROM loyalty_transactions WHERE customer_id = :customerId
      ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { customerId, limit, offset: (page - 1) * limit }
  );

  const counted = await selectOne(
    db,
    'SELECT count(*)::int AS total FROM loyalty_transactions WHERE customer_id = :customerId',
    { customerId }
  );

  return { transactions: rows.map(publicLoyalty), total: counted.total };
};

/**
 * The balance, and what it is made of.
 *
 * Totals come from the ledger and the balance from the account, so a
 * disagreement between them is visible rather than hidden — which is the whole
 * reason for keeping both.
 */
export const loyaltySummary = async (customerId, db = getSequelize()) => {
  const row = await selectOne(
    db,
    `SELECT
       COALESCE(SUM(points) FILTER (WHERE type = 'earn'), 0)::int      AS earned,
       COALESCE(-SUM(points) FILTER (WHERE type = 'redeem'), 0)::int   AS redeemed,
       COALESCE(SUM(points) FILTER (WHERE type = 'adjustment'), 0)::int AS adjusted
     FROM loyalty_transactions WHERE customer_id = :customerId`,
    { customerId }
  );

  return { totalEarned: row.earned, totalRedeemed: row.redeemed, totalAdjusted: row.adjusted };
};
