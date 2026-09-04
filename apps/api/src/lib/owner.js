import { getSequelize } from '../db/sequelize.js';
import { CartError, ensureGuestSession } from '../services/cart.js';
import { isValidId } from '../services/catalog.js';

/**
 * Who this request's cart and wishlist belong to.
 *
 * `identifyGuest` puts either a signed-in principal on `req.user` or an
 * anonymous cookie on `req.guestSession`. Both become the same shape here — a
 * single owner with exactly one id set — so nothing downstream branches on
 * which kind of shopper it is talking to.
 *
 * The anonymous id is resolved to a `guest_sessions` row on the way through,
 * creating one if the cookie names a session that has since been swept.
 */
export const resolveOwner = async (req, db = getSequelize()) => {
  const customerId = req.user?.id ?? req.user?._id;

  if (customerId) {
    // Sign-in mints `customers` rows now, so this is a UUID. A cookie issued
    // before that migration still names an ObjectId; it belongs to no account
    // and is treated as one, rather than reaching Postgres as a cast error.
    if (!isValidId(String(customerId))) {
      throw new CartError('Unauthorized: Please sign in again.', 401);
    }
    return { customerId: String(customerId), guestSessionId: null };
  }

  const anonymousId = req.guestSession?.anonymousId;
  if (anonymousId) {
    return {
      customerId: null,
      guestSessionId: await ensureGuestSession(anonymousId, db),
    };
  }

  throw new CartError('Unauthorized: No user or guest session found.', 401);
};
