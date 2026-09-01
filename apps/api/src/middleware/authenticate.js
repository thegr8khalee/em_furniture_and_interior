import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import { resolvePermissions } from '../lib/permissions.js';
import { verifySupabaseToken, bearerToken } from '../lib/supabaseAuth.js';

/**
 * Resolve the caller from a Supabase access token.
 *
 * Replaces the two legacy middlewares, which read a cookie literally named
 * `jwt` for both customers and staff on the same domain — so signing into the
 * storefront destroyed an admin session and vice versa (finding F-10). A bearer
 * token carries no such collision, and it is also what makes the split apps
 * work across origins without SameSite gymnastics.
 *
 * Staff and customers share one Supabase user pool. Which one a token belongs
 * to is decided here, by looking the Supabase id up in Mongo — never by trusting
 * a claim inside the token, which the client half-controls via user_metadata.
 */

/** Attaches req.actor when a valid token is present. Never rejects. */
export const identify = async (req, res, next) => {
  try {
    const token = bearerToken(req);
    if (!token) return next();

    const { payload, error } = await verifySupabaseToken(token);
    if (error) {
      req.authError = error;
      return next();
    }

    const supabaseUserId = payload.sub;

    // Staff first: an identity that is both would otherwise resolve as a
    // customer and silently lose its permissions.
    const admin = await Admin.findOne({ supabaseUserId }).select('-passwordHash');
    if (admin) {
      const permissions = resolvePermissions(admin.role, admin.permissions);
      req.admin = admin;
      req.adminPermissions = permissions;
      req.adminRole = admin.role;
      req.actor = { kind: 'staff', id: admin._id, supabaseUserId, role: admin.role, permissions };
      return next();
    }

    const user = await User.findOne({ supabaseUserId }).select('-passwordHash');
    if (user) {
      req.user = user;
      req.actor = { kind: 'customer', id: user._id, supabaseUserId };
      return next();
    }

    // Anonymous sign-ins replace the hand-rolled guest cookie. They carry a
    // valid token but no Mongo record, which is the point: a guest has a stable
    // identity for their cart without an account.
    if (payload.is_anonymous) {
      req.actor = { kind: 'guest', supabaseUserId };
      req.guestSession = { anonymousId: supabaseUserId };
      return next();
    }

    // Authenticated in Supabase but unknown here — a signup whose Mongo record
    // failed, or a user from before the import. Not an error; just not known.
    req.actor = { kind: 'unlinked', supabaseUserId, email: payload.email };
    return next();
  } catch (err) {
    console.error('identify middleware error:', err.message);
    return next();
  }
};

/** Requires any authenticated customer. */
export const requireUser = (req, res, next) => {
  if (req.user) return next();
  return res.status(401).json({ message: req.authError || 'Authentication required.' });
};

/** Requires a linked staff account. */
export const requireStaff = (req, res, next) => {
  if (req.admin) return next();
  if (req.authError) return res.status(401).json({ message: req.authError });
  if (req.actor) return res.status(403).json({ message: 'Not authorized: staff access required.' });
  return res.status(401).json({ message: 'Authentication required.' });
};
