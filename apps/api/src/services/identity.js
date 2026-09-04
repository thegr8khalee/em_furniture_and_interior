import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { QueryTypes } from 'sequelize';
import { resolvePermissions } from '@em/shared/permissions';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';

/**
 * Accounts, against PostgreSQL.
 *
 * Two tables, not one. A shopper has a cart, an address and loyalty points; an
 * operator has a role, a permission set and an audit trail; the only thing they
 * share is an email and a password. Mongo modelled them as two collections
 * already, but every handler reached for whichever one it happened to need and
 * the two flows were copies of each other — `signup` and `adminSignup` differ in
 * about six lines, none of them the interesting ones.
 *
 * Everything that touches a password or a reset token lives here. The
 * controllers above are HTTP shells: translate the request, translate the error.
 * That is the same split the catalog and cart slices used.
 *
 * The published shapes are unchanged, with two exceptions, both of which were
 * already lies:
 *
 *   - `cart` and `wishlist` no longer appear on a sign-in response. They were
 *     the embedded Mongo arrays, which stopped being the cart when carts moved
 *     to `carts`/`cart_items`. Nothing in either frontend read them.
 *   - A customer's display name is `full_name` in the database and is still
 *     published as `username`, because that is the field both frontends read
 *     and send back. Mongo called it `username` and stored a full name in it.
 */

export class IdentityError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'IdentityError';
    this.status = status;
  }
}

const BCRYPT_ROUNDS = 10;

/** Password reset links are valid for an hour, as they were under Mongo. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

/**
 * `password_hash` is nullable — a Supabase-managed identity carries no local
 * password (see `customers_has_credential`). Handing null to bcrypt throws, so
 * an account with no local password fails the check rather than the request.
 */
const passwordMatches = async (password, hash) => {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
};

/** Reset tokens are stored hashed, so a leaked database row is not a live link. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const publicCustomer = (row) => ({
  // `_id` is what both frontends read; `id` is what the rest of the API now
  // passes to Postgres. Publishing both keeps this slice from rippling outward.
  _id: row.id,
  id: row.id,
  username: row.full_name,
  email: row.email,
  phoneNumber: row.phone_number,
  loyaltyPoints: row.loyalty_points,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const publicStaff = (row) => ({
  _id: row.id,
  id: row.id,
  username: row.username,
  email: row.email,
  // `role` is the kind of principal, which is what the frontends switch on;
  // `adminRole` is the operator's role within the console. Two different things
  // that both ended up called "role", and renaming either is a frontend change.
  role: 'admin',
  adminRole: row.role,
  permissions: resolvePermissions(row.role, row.permissions),
  isActive: row.is_active,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const CUSTOMER_COLUMNS = `id, email, full_name, phone_number, loyalty_points, created_at, updated_at`;
const STAFF_COLUMNS = `id, username, email, role, permissions, is_active, last_login_at, created_at, updated_at`;

const one = async (db, sql, replacements) => {
  const rows = await db.query(sql, { replacements, type: QueryTypes.SELECT });
  return rows[0] ?? null;
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Registers a shopper.
 *
 * The duplicate-email check is the unique index, not a prior SELECT. Two
 * simultaneous signups with the same address used to race through
 * `findOne` before either had written, and the loser got a 500 from the index
 * it had just violated; `ON CONFLICT DO NOTHING` makes that case a 400 like any
 * other duplicate.
 */
export const registerCustomer = async (
  { fullName, email, password, phoneNumber = null },
  db = getSequelize()
) => {
  if (!fullName) throw new IdentityError('Full name cannot be empty');
  if (!email) throw new IdentityError('Email cannot be empty');
  if (!password) throw new IdentityError('Password cannot be empty');

  const row = await one(
    db,
    `INSERT INTO customers (email, full_name, phone_number, password_hash)
     VALUES (:email, :fullName, :phoneNumber, :passwordHash)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${CUSTOMER_COLUMNS}`,
    {
      email,
      fullName,
      phoneNumber: phoneNumber || null,
      passwordHash: await hashPassword(password),
    }
  );

  if (!row) throw new IdentityError('Email already in use');
  return publicCustomer(row);
};

/**
 * Verifies a shopper's credentials.
 *
 * A wrong password and an unknown email give the same answer, in the same
 * words, so the response cannot be used to enumerate accounts.
 */
export const authenticateCustomer = async (email, password, db = getSequelize()) => {
  if (!email || !password) throw new IdentityError('All fields are required');

  const row = await one(
    db,
    `SELECT ${CUSTOMER_COLUMNS}, password_hash FROM customers WHERE email = :email`,
    { email }
  );

  if (!row || !(await passwordMatches(password, row.password_hash))) {
    throw new IdentityError('Invalid Credentials');
  }

  return publicCustomer(row);
};

/**
 * Null for an id that is not a UUID.
 *
 * A cookie minted before this migration carries a Mongo ObjectId. Postgres
 * rejects it as a malformed uuid, which would reach the caller as a 500 with a
 * cast error in the logs; "no such account" is both true and actionable — the
 * middleware clears the cookie and asks them to sign in again.
 */
export const findCustomerById = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return null;

  const row = await one(
    db,
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = :id`,
    { id }
  );
  return row ? publicCustomer(row) : null;
};

/**
 * Looks up many accounts at once, as a Map keyed by id.
 *
 * This is what replaces `.populate('user', ...)` for the collections still in
 * Mongo: the reference is a UUID into another database, so the join has to
 * happen in the application. One statement for a page of rows, not one per row.
 */
const byIds = async (table, columns, shape, ids, db) => {
  const unique = [...new Set((ids || []).filter((id) => isValidId(String(id ?? ''))))];
  if (unique.length === 0) return new Map();

  const rows = await db.query(
    `SELECT ${columns} FROM ${table} WHERE id IN (:ids)`,
    { replacements: { ids: unique }, type: QueryTypes.SELECT }
  );

  return new Map(rows.map((row) => [row.id, shape(row)]));
};

export const findCustomersByIds = (ids, db = getSequelize()) =>
  byIds('customers', CUSTOMER_COLUMNS, publicCustomer, ids, db);

export const findStaffByIds = (ids, db = getSequelize()) =>
  byIds('staff', STAFF_COLUMNS, publicStaff, ids, db);

/**
 * Updates the fields a shopper may change about themselves.
 *
 * Only the keys actually present are written, so a client that sends `{ email }`
 * does not blank the phone number. `COALESCE` on the parameter does that in one
 * statement; the previous version read the document, mutated it in JavaScript
 * and saved it back, which loses a concurrent write to any other field.
 */
export const updateCustomerProfile = async (
  id,
  { username, email, phoneNumber },
  db = getSequelize()
) => {
  const row = await one(
    db,
    `UPDATE customers SET
       full_name    = COALESCE(:fullName, full_name),
       email        = COALESCE(:email, email),
       phone_number = CASE WHEN :phoneNumberGiven THEN :phoneNumber ELSE phone_number END
     WHERE id = :id
     RETURNING ${CUSTOMER_COLUMNS}`,
    {
      id,
      fullName: username ?? null,
      email: email ?? null,
      // Distinguished from "not sent" so clearing a phone number stays possible.
      phoneNumberGiven: phoneNumber !== undefined,
      phoneNumber: phoneNumber ?? null,
    }
  ).catch((error) => {
    if (error?.original?.constraint === 'customers_email_key') {
      throw new IdentityError('Email already in use by another user.');
    }
    throw error;
  });

  if (!row) throw new IdentityError('User not found.', 404);
  return publicCustomer(row);
};

export const deleteCustomer = async (id, db = getSequelize()) => {
  const [, result] = await db.query('DELETE FROM customers WHERE id = :id', {
    replacements: { id },
  });
  return (result?.rowCount ?? 0) > 0;
};

/**
 * Adds loyalty points to an account.
 *
 * `loyalty_points >= 0` is a check constraint, so a redemption that would go
 * negative is refused by the database rather than by whichever caller
 * remembered to look.
 */
export const creditLoyaltyPoints = async (id, points, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return null;

  const row = await one(
    db,
    `UPDATE customers SET loyalty_points = loyalty_points + :points
      WHERE id = :id RETURNING loyalty_points`,
    { id, points }
  );

  return row ? row.loyalty_points : null;
};

/** How many accounts were opened in a window, for the console's funnel. */
export const countCustomers = async ({ from, to } = {}, db = getSequelize()) => {
  const rows = await db.query(
    `SELECT count(*)::int AS total FROM customers
      WHERE (:from::timestamptz IS NULL OR created_at >= :from)
        AND (:to::timestamptz IS NULL OR created_at <= :to)`,
    { replacements: { from: from ?? null, to: to ?? null }, type: QueryTypes.SELECT }
  );
  return rows[0].total;
};

export const changeCustomerPassword = async (
  id,
  oldPassword,
  newPassword,
  db = getSequelize()
) => {
  const row = await one(db, 'SELECT password_hash FROM customers WHERE id = :id', { id });
  if (!row) throw new IdentityError('User not found.', 404);

  if (!(await passwordMatches(oldPassword, row.password_hash))) {
    throw new IdentityError('Incorrect old password.');
  }

  await db.query(
    'UPDATE customers SET password_hash = :passwordHash WHERE id = :id',
    { replacements: { id, passwordHash: await hashPassword(newPassword) } }
  );
};

/**
 * Issues a password reset token, or reports that there is no such account.
 *
 * The caller sends the same response either way — telling an anonymous caller
 * which addresses have accounts is the enumeration hole this shape exists to
 * close — so the distinction stays inside the service, where the email sender
 * needs it.
 */
export const beginPasswordReset = async (email, db = getSequelize()) => {
  const token = crypto.randomBytes(32).toString('hex');

  const row = await one(
    db,
    `UPDATE customers
        SET password_reset_token = :tokenHash,
            password_reset_expires = :expires
      WHERE email = :email
      RETURNING ${CUSTOMER_COLUMNS}`,
    {
      email,
      tokenHash: hashToken(token),
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    }
  );

  return row ? { customer: publicCustomer(row), token } : null;
};

/**
 * Spends a reset token.
 *
 * Matching and clearing happen in one statement. Read-then-write let the same
 * link be redeemed twice if both requests read before either wrote, and the
 * second one won.
 */
export const completePasswordReset = async (token, newPassword, db = getSequelize()) => {
  const row = await one(
    db,
    `UPDATE customers
        SET password_hash = :passwordHash,
            password_reset_token = NULL,
            password_reset_expires = NULL
      WHERE password_reset_token = :tokenHash
        AND password_reset_expires > now()
      RETURNING id`,
    { tokenHash: hashToken(token), passwordHash: await hashPassword(newPassword) }
  );

  if (!row) {
    throw new IdentityError('Password reset token is invalid or has expired.');
  }
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const registerStaff = async (
  { username, email, password, role = 'admin' },
  db = getSequelize()
) => {
  if (!username || !email || !password) {
    throw new IdentityError(
      'All fields (username, email, password) are required for admin signup.'
    );
  }

  const row = await one(
    db,
    `INSERT INTO staff (username, email, password_hash, role)
     VALUES (:username, :email, :passwordHash, :role)
     ON CONFLICT DO NOTHING
     RETURNING ${STAFF_COLUMNS}`,
    { username, email, role, passwordHash: await hashPassword(password) }
  ).catch((error) => {
    // An unknown role is a bad request, not a server fault: `staff_role` is an
    // enum, and Postgres rejects the cast before the insert is attempted.
    if (error?.original?.code === '22P02') {
      throw new IdentityError(`"${role}" is not a role.`);
    }
    throw error;
  });

  if (!row) {
    throw new IdentityError('Admin with this email or username already exists.');
  }
  return publicStaff(row);
};

/**
 * Verifies an operator's credentials and records the sign-in.
 *
 * `is_active` is honoured here for the first time. Mongo's admin document had
 * no such field, so the only way to revoke console access was to delete the
 * account — which also erased the audit trail pointing at it.
 */
export const authenticateStaff = async (email, password, db = getSequelize()) => {
  if (!email || !password) {
    throw new IdentityError('Email and password are required for admin login.');
  }

  const row = await one(
    db,
    `SELECT ${STAFF_COLUMNS}, password_hash FROM staff WHERE email = :email`,
    { email }
  );

  if (!row || !(await passwordMatches(password, row.password_hash))) {
    throw new IdentityError('Invalid Credentials');
  }

  if (!row.is_active) {
    throw new IdentityError('This account has been deactivated.', 403);
  }

  await db.query('UPDATE staff SET last_login_at = now() WHERE id = :id', {
    replacements: { id: row.id },
  });

  return publicStaff(row);
};

export const findStaffById = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return null;

  const row = await one(db, `SELECT ${STAFF_COLUMNS} FROM staff WHERE id = :id`, { id });
  return row ? publicStaff(row) : null;
};
