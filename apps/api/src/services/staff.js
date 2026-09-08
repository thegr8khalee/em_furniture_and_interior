import { QueryTypes } from 'sequelize';
import { PERMISSIONS, ROLES, resolvePermissions } from '@em/shared/permissions';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { textArray } from '../lib/sql.js';

/**
 * Who can get into the console, and what they may do there.
 *
 * `POST /api/admin/signup` could create an operator and nothing could list one.
 * So there was no way to see who had access, no way to take it away, and no way
 * to change a role short of writing SQL — while `staff.manage` existed as a
 * permission with nothing behind it.
 *
 * Everything here is behind that permission, which no role list grants, so only
 * super_admin holds it. An operator who can hand out access is an owner.
 */

export class StaffError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'StaffError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const COLUMNS = `id, username, email, role, permissions, is_active, last_login_at,
                 supabase_user_id, created_at, updated_at`;

const publicStaff = (row) => ({
  _id: row.id,
  id: row.id,
  username: row.username,
  email: row.email,
  role: 'admin',
  adminRole: row.role,
  // What they can actually do, which is the role's list unless overridden.
  permissions: resolvePermissions(row.role, row.permissions),
  // And whether that came from the role or from a grant made by hand, because
  // "why can this person do that?" is the question this screen has to answer.
  hasExplicitPermissions: (row.permissions ?? []).length > 0,
  explicitPermissions: row.permissions ?? [],
  isActive: row.is_active,
  signsInWith: row.supabase_user_id ? 'supabase' : 'password',
  lastLoginAt: row.last_login_at,
  actionCount: row.action_count === undefined ? undefined : Number(row.action_count),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Every operator, with how recently they have done anything. */
export const listStaff = async ({ includeInactive = true } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT s.id, s.username, s.email, s.role, s.permissions, s.is_active,
            s.last_login_at, s.supabase_user_id, s.created_at, s.updated_at,
            COALESCE(a.action_count, 0) AS action_count
       FROM staff s
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS action_count
           FROM audit_logs l WHERE l.actor_id = s.id
       ) a ON true
      ${includeInactive ? '' : 'WHERE s.is_active'}
      ORDER BY s.is_active DESC, s.created_at`
  );

  return rows.map(publicStaff);
};

export const getStaff = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new StaffError('Operator not found.', 404);

  const row = await selectOne(db, `SELECT ${COLUMNS} FROM staff WHERE id = :id`, { id });
  if (!row) throw new StaffError('Operator not found.', 404);

  const recent = await select(
    db,
    `SELECT action::text, resource_type, resource_name, created_at, status::text
       FROM audit_logs WHERE actor_id = :id
      ORDER BY created_at DESC LIMIT 20`,
    { id }
  );

  return {
    ...publicStaff(row),
    recentActivity: recent.map((entry) => ({
      action: entry.action,
      resourceType: entry.resource_type,
      resourceName: entry.resource_name,
      outcome: entry.status,
      at: entry.created_at,
    })),
  };
};

/** The roles and permissions a screen can offer, rather than hard-coding them there. */
export const staffOptions = () => ({
  roles: Object.values(ROLES).map((role) => ({
    value: role,
    permissions: resolvePermissions(role, []),
  })),
  permissions: Object.values(PERMISSIONS),
});

/**
 * How many active super_admins remain if this one changes.
 *
 * The two ways to lock everybody out of a system like this are deactivating the
 * last owner and demoting them. Both are checked against this.
 */
const otherActiveOwners = async (db, id, opts) => {
  const row = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM staff
      WHERE role = 'super_admin' AND is_active AND id <> :id`,
    { id },
    opts
  );
  return row.total;
};

/**
 * Changes an operator's name, role, permission grant or active flag.
 *
 * Three refusals, each of which is a way the console could be lost:
 *
 *   - **Nobody edits themselves here.** Not their own role, not their own active
 *     flag. An owner who demotes themselves by mistake cannot undo it, because
 *     undoing it needs the permission they just gave away.
 *   - **The last active super_admin cannot be deactivated or demoted.** That is
 *     the state with no way back in.
 *   - **A permission that does not exist is refused**, rather than stored and
 *     silently never matching anything.
 */
export const updateStaff = async (id, input, actorId, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new StaffError('Operator not found.', 404);

  const { username, role, permissions, isActive } = input ?? {};

  if (role !== undefined && !Object.values(ROLES).includes(role)) {
    throw new StaffError(`"${role}" is not a role.`);
  }

  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) throw new StaffError('Permissions must be a list.');

    const known = new Set(Object.values(PERMISSIONS));
    const unknown = permissions.filter((permission) => !known.has(permission));
    if (unknown.length > 0) {
      throw new StaffError(`No such permission: ${unknown.join(', ')}.`);
    }
  }

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      `SELECT ${COLUMNS} FROM staff WHERE id = :id FOR UPDATE`,
      { id },
      opts
    );
    if (!before) throw new StaffError('Operator not found.', 404);

    const changingAccess =
      (role !== undefined && role !== before.role) ||
      (isActive !== undefined && isActive !== before.is_active);

    if (changingAccess && String(actorId) === String(id)) {
      throw new StaffError(
        'You cannot change your own role or deactivate yourself. Ask another owner.',
        403
      );
    }

    if (before.role === ROLES.SUPER_ADMIN && changingAccess) {
      const others = await otherActiveOwners(db, id, opts);
      if (others === 0) {
        throw new StaffError(
          'This is the last active owner. Promote someone else first, or nobody can get back in.'
        );
      }
    }

    const row = await selectOne(
      db,
      `UPDATE staff SET
         username = COALESCE(:username, username),
         role = COALESCE(:role::staff_role, role),
         permissions = CASE WHEN :permissionsGiven THEN :permissions::text[] ELSE permissions END,
         is_active = COALESCE(:isActive, is_active)
       WHERE id = :id
       RETURNING ${COLUMNS}`,
      {
        id,
        username: username ?? null,
        role: role ?? null,
        permissionsGiven: permissions !== undefined,
        // A text[] literal: Sequelize expands a JS array into a comma-separated
        // list, which is right for IN (:ids) and wrong for an array column.
        permissions: permissions === undefined ? null : textArray(permissions),
        isActive: typeof isActive === 'boolean' ? isActive : null,
      },
      opts
    ).catch((error) => {
      if (error?.original?.constraint === 'staff_username_key') {
        throw new StaffError(`There is already an operator called ${username}.`);
      }
      throw error;
    });

    return publicStaff(row);
  });
};

/**
 * Ends an operator's access.
 *
 * Deactivation, not deletion. `staff` is referenced by every audit entry, every
 * approved expense and every order status change; removing the row would take
 * their name off the record of what they did, which is the opposite of what an
 * audit trail is for. `protectAdminRoute` refuses an inactive account on the
 * next request.
 */
export const deactivateStaff = async (id, actorId, db = getSequelize()) =>
  updateStaff(id, { isActive: false }, actorId, db);
