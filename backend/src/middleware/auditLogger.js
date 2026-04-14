import AuditLog from '../models/auditLog.model.js';

/**
 * Middleware to log audit trail for admin actions
 * Should be applied after authentication middleware
 */
export const createAuditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;

    // Capture response data
    let responseData = null;
    let responseStatus = null;

    // Override res.json to capture response
    res.json = function (data) {
      responseData = data;
      responseStatus = res.statusCode;
      return originalJson.call(this, data);
    };

    // Override res.send to capture response
    res.send = function (data) {
      responseData = data;
      responseStatus = res.statusCode;
      return originalSend.call(this, data);
    };

    // Wait for response to complete
    res.on('finish', async () => {
      try {
        // Only log successful actions (2xx status codes)
        if (responseStatus >= 200 && responseStatus < 300) {
          const logEntry = {
            actor: req.admin._id,
            actorEmail: req.admin.email,
            action,
            resourceType,
            resourceId: req.params.id || req.params.productId || req.params.collectionId || req.params.orderId,
            resourceName: req.body?.name || req.body?.title || req.body?.orderNumber,
            changes: req.body,
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            status: 'success',
          };

          await AuditLog.create(logEntry);
        } else if (responseStatus >= 400) {
          // Log failed actions
          const logEntry = {
            actor: req.admin._id,
            actorEmail: req.admin.email,
            action,
            resourceType,
            resourceId: req.params.id || req.params.productId || req.params.collectionId,
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            status: 'failed',
            errorMessage: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
          };

          await AuditLog.create(logEntry);
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        console.error('Audit log error:', error);
      }
    });

    next();
  };
};

/**
 * Manually create an audit log entry
 * Useful for actions that don't go through standard middleware
 */
export const logAuditAction = async ({
  actor,
  actorEmail,
  action,
  resourceType,
  resourceId,
  resourceName,
  changes,
  metadata,
  ipAddress,
  userAgent,
  status = 'success',
  errorMessage,
}) => {
  try {
    await AuditLog.create({
      actor,
      actorEmail,
      action,
      resourceType,
      resourceId,
      resourceName,
      changes,
      metadata,
      ipAddress,
      userAgent,
      status,
      errorMessage,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};
