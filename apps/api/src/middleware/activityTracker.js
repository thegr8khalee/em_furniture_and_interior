import { recordActivity } from '../services/logs.js';
import { ensureGuestSession } from '../services/cart.js';
import { logger } from '../lib/logger.js';

/**
 * Records what a shopper did.
 *
 * Fire and forget, deliberately: an activity log is worth having and never
 * worth delaying a page for, let alone failing one. `recordActivity` does not
 * throw, so the floating promise cannot become an unhandled rejection.
 *
 * It used to read `req.guest`, which nothing has ever set — `identifyGuest`
 * puts the anonymous shopper on `req.guestSession` — so every guest activity
 * was silently dropped, and the whole middleware short-circuited for anyone not
 * signed in.
 */
export const trackActivity = (activityType, resourceType = null) => {
  return (req, _res, next) => {
    const customerId = req.user?.id ?? null;
    const anonymousId = req.guestSession?.anonymousId ?? null;

    if (!customerId && !anonymousId) return next();

    const resourceId =
      req.params.id ||
      req.params.productId ||
      req.params.collectionId ||
      req.params.projectId ||
      req.params.slug ||
      req.body?.productId ||
      null;

    const entry = {
      customerId,
      activityType,
      resourceType,
      resourceId,
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        ...(activityType === 'SEARCH'
          ? { search: req.query.q ?? req.body?.query ?? null }
          : {}),
      },
      sessionId: req.cookies?.sessionId ?? null,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      referrer: req.get('referrer'),
      page: req.originalUrl,
    };

    // A guest's session row is created on their first write; a page view should
    // not create one, so the activity is recorded against the session only when
    // it already exists.
    const resolve = customerId
      ? Promise.resolve(entry)
      : ensureGuestSession(anonymousId)
          .then((guestSessionId) => ({ ...entry, guestSessionId }))
          .catch(() => entry);

    resolve
      .then((resolved) => recordActivity(resolved))
      .catch((error) => logger.error({ err: error }, 'Activity tracking error'));

    next();
  };
};

/**
 * Records an activity from somewhere that is not a route.
 */
export const logActivity = (entry) => recordActivity(entry);
