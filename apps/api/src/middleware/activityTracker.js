import ActivityLog from '../models/activityLog.model.js';

/**
 * Middleware to track user activity
 * Can be used for both authenticated and guest users
 */
export const trackActivity = (activityType, resourceType = null) => {
  return async (req, res, next) => {
    try {
      // Extract user/guest info
      const userId = req.user?._id || null;
      const guestId = req.guest?._id || null;

      // Only track if we have a user or guest
      if (!userId && !guestId) {
        return next();
      }

      // Extract resource info from params or body
      const resourceId = 
        req.params.id || 
        req.params.productId || 
        req.params.collectionId || 
        req.params.projectId || 
        req.params.slug ||
        req.body.productId ||
        null;

      // Create activity log entry
      const activityData = {
        user: userId,
        guest: guestId,
        activityType,
        resourceType,
        resourceId,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: activityType === 'SEARCH' ? { query: req.query.q || req.body.query } : undefined,
        },
        sessionId: req.sessionID || req.cookies?.sessionId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        referrer: req.get('referrer'),
        page: req.originalUrl,
      };

      // Don't await - fire and forget to not slow down the request
      ActivityLog.create(activityData).catch((error) => {
        console.error('Activity tracking error:', error);
      });
    } catch (error) {
      console.error('Activity tracking middleware error:', error);
    }

    next();
  };
};

/**
 * Manually track an activity
 * Useful for activities that don't go through standard middleware
 */
export const logActivity = async ({
  user,
  guest,
  activityType,
  resourceType,
  resourceId,
  metadata,
  sessionId,
  ipAddress,
  userAgent,
  referrer,
  page,
}) => {
  try {
    await ActivityLog.create({
      user,
      guest,
      activityType,
      resourceType,
      resourceId,
      metadata,
      sessionId,
      ipAddress,
      userAgent,
      referrer,
      page,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
