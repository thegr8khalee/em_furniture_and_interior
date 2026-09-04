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
    // Sign-in still runs against the old store, which issues Mongo ObjectIds.
    // Handing one to Postgres would surface as a 500 with a cast error in the
    // logs and nothing useful in the response; say what is actually wrong until
    // the auth migration lands and this branch stops being reachable.
    if (!isValidId(String(customerId))) {
      throw new CartError(
        'Signed-in carts are unavailable while accounts are being migrated.',
        503
      );
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
