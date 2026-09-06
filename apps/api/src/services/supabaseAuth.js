import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { IdentityError, publicCustomer, publicStaff } from './identity.js';
import { logger } from '../lib/logger.js';

/**
 * Signing in against Supabase Auth.
 *
 * Both account tables have carried a nullable `supabase_user_id` and a
 * `*_has_credential` check since 0002 — an account must be reachable by a local
 * password or by a Supabase identity — but nothing ever set one, so every
 * sign-in was still the local bcrypt path.
 *
 * This is the bridge, and it is deliberately a bridge rather than a
 * replacement. The frontend signs in with Supabase's own SDK and posts the
 * access token here; we verify it, find or create the local row, and issue the
 * session cookie the rest of the API already understands. Nothing downstream
 * changes: `protectRoute` still reads one cookie, and the bcrypt path still
 * works for every account that has a password. Cutting over both frontends and
 * every protected route in one step would have meant a day where nobody could
 * sign in if any part of it was wrong.
 *
 * **Verification is Supabase's job, not ours.** The token goes to
 * `/auth/v1/user`, which is the only party that can say whether it has been
 * revoked. Verifying the signature locally would accept a token from a session
 * signed out ten minutes ago, and it would mean tracking which signing
 * algorithm a given project uses. This costs one round trip at sign-in, after
 * which the session is ours.
 */

const AUTH_TIMEOUT_MS = 8000;

const one = async (db, sql, replacements) => {
  const rows = await db.query(sql, { replacements, type: QueryTypes.SELECT });
  return rows[0] ?? null;
};

const CUSTOMER_COLUMNS = `id, email, full_name, phone_number, loyalty_points, created_at, updated_at`;
const STAFF_COLUMNS = `id, username, email, role, permissions, is_active, last_login_at, created_at, updated_at`;

/**
 * Whether this installation can use Supabase Auth at all.
 *
 * The anon key is required as well as the URL: `/auth/v1/user` needs it as the
 * `apikey` header even when the caller has a bearer token.
 */
export const isSupabaseAuthConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

/**
 * Asks Supabase who this token belongs to.
 *
 * Anything other than a clean 200 is a 401 in the same words, so the response
 * cannot be used to tell an expired token from a forged one.
 */
export const verifySupabaseToken = async (accessToken) => {
  if (!isSupabaseAuthConfigured()) {
    throw new IdentityError('Supabase sign-in is not configured on this server.', 503);
  }
  if (!accessToken || typeof accessToken !== 'string') {
    throw new IdentityError('Not authorized, no access token.', 401);
  }

  const url = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
  } catch (error) {
    // Supabase being unreachable is our problem, not the caller's: a 401 here
    // would tell them their credentials are wrong when they are not.
    logger.error({ err: error }, 'Could not reach Supabase Auth');
    throw new IdentityError('Could not reach the sign-in service. Try again.', 503);
  }

  if (!response.ok) {
    throw new IdentityError('Not authorized, invalid or expired token.', 401);
  }

  const user = await response.json();

  if (!user?.id || !user?.email) {
    throw new IdentityError('Not authorized, invalid or expired token.', 401);
  }

  return {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split('@')[0],
    phone: user.user_metadata?.phone || user.phone || null,
  };
};

/**
 * Finds, links or creates the shopper behind a verified Supabase identity.
 *
 * Three cases, in order. Already linked: sign them in. A local account with the
 * same email: link it, because a shopper who signs up with Google using the
 * address they already ordered under is the same person, and a second row would
 * split their orders and their loyalty points across two accounts they cannot
 * see. Neither: create one, with no password — `customers_has_credential` is
 * satisfied by the Supabase id.
 *
 * Email is the join key because Supabase verifies it. If it ever stops doing so
 * this becomes an account-takeover path, which is why the link is by verified
 * email and not by anything the user types.
 */
export const linkCustomer = async (identity, db = getSequelize()) => {
  const linked = await one(
    db,
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE supabase_user_id = :supabaseId`,
    { supabaseId: identity.id }
  );
  if (linked) return { customer: publicCustomer(linked), created: false, linked: false };

  const adopted = await one(
    db,
    `UPDATE customers SET supabase_user_id = :supabaseId
      WHERE email = :email AND supabase_user_id IS NULL
      RETURNING ${CUSTOMER_COLUMNS}`,
    { supabaseId: identity.id, email: identity.email }
  );
  if (adopted) return { customer: publicCustomer(adopted), created: false, linked: true };

  const created = await one(
    db,
    `INSERT INTO customers (email, full_name, phone_number, supabase_user_id)
     VALUES (:email, :fullName, :phone, :supabaseId)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${CUSTOMER_COLUMNS}`,
    {
      email: identity.email,
      fullName: identity.name,
      phone: identity.phone,
      supabaseId: identity.id,
    }
  );

  // The email exists but is already linked to a different Supabase identity —
  // two providers, one address. Refusing is the honest answer; silently
  // relinking would hand the account to whoever signed up second.
  if (!created) {
    throw new IdentityError('That email is already linked to a different sign-in.', 409);
  }

  return { customer: publicCustomer(created), created: true, linked: false };
};

/**
 * Finds or links the operator behind a verified Supabase identity.
 *
 * Never creates one. A console account carries a role and a permission set, and
 * an operator who can provision themselves is a privilege escalation with extra
 * steps: anyone who could sign up to the Supabase project would become staff.
 * An operator is created by `npm run bootstrap:staff` or by another operator
 * holding `staff.manage`, and only then can they sign in this way.
 */
export const linkStaff = async (identity, db = getSequelize()) => {
  const linked = await one(
    db,
    `SELECT ${STAFF_COLUMNS} FROM staff WHERE supabase_user_id = :supabaseId`,
    { supabaseId: identity.id }
  );

  const staff =
    linked ??
    (await one(
      db,
      `UPDATE staff SET supabase_user_id = :supabaseId
        WHERE email = :email AND supabase_user_id IS NULL
        RETURNING ${STAFF_COLUMNS}`,
      { supabaseId: identity.id, email: identity.email }
    ));

  if (!staff) {
    throw new IdentityError('This account is not an operator on this system.', 403);
  }

  // Checked after the lookup, not folded into it, so a deactivated operator is
  // told what is wrong instead of being told they are not staff at all.
  if (!staff.is_active) {
    throw new IdentityError('Not authorized, this account has been deactivated.', 403);
  }

  await db.query('UPDATE staff SET last_login_at = now() WHERE id = :id', {
    replacements: { id: staff.id },
  });

  return publicStaff(staff);
};

/** The whole exchange for a shopper: verify the token, resolve the account. */
export const signInCustomerWithSupabase = async (accessToken, db = getSequelize()) =>
  linkCustomer(await verifySupabaseToken(accessToken), db);

/** The same for an operator, minus the provisioning. */
export const signInStaffWithSupabase = async (accessToken, db = getSequelize()) =>
  linkStaff(await verifySupabaseToken(accessToken), db);
