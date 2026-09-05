import { recordAudit } from '../services/logs.js';

/**
 * Fields never worth keeping, and dangerous to keep.
 *
 * `changes` is the request body verbatim, so any route carrying a credential
 * would write it to a log the console then displays. Operator creation is one
 * such route, and it is exactly the action most worth auditing — so the entry
 * stays and the secret goes.
 */
const SECRETS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'passwordHash',
  'token',
  'secret',
  'apiKey',
]);

const redact = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      SECRETS.has(key) ? '[redacted]' : value,
    ])
  );
};

/**
 * Records what an operator did.
 *
 * Applied after authentication, and written when the response finishes so the
 * outcome is known — a refused action is as worth recording as a successful
 * one, and the old version only logged the successful ones for `changes`.
 *
 * `recordAudit` never throws: a logging failure that turned a completed action
 * into a 500 would lose the action as well as the record of it.
 */
export const createAuditLog = (action, resourceType) => {
  return (req, res, next) => {
    const originalJson = res.json;
    const originalSend = res.send;

    let responseData = null;

    res.json = function (data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    res.send = function (data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.on('finish', () => {
      const succeeded = res.statusCode >= 200 && res.statusCode < 300;

      recordAudit({
        actorId: req.admin?.id,
        actorEmail: req.admin?.email,
        action,
        resourceType,
        resourceId:
          req.params.id ||
          req.params.productId ||
          req.params.collectionId ||
          req.params.orderId ||
          req.params.projectId ||
          req.params.couponId ||
          req.params.designerId ||
          null,
        resourceName: req.body?.name || req.body?.title || req.body?.orderNumber || null,
        changes: succeeded ? redact(req.body) : undefined,
        metadata: { method: req.method, path: req.path, query: req.query },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        status: succeeded ? 'success' : 'failed',
        errorMessage: succeeded
          ? null
          : typeof responseData === 'string'
            ? responseData
            : JSON.stringify(responseData ?? null),
      });
    });

    next();
  };
};

/**
 * Records an action from somewhere that is not a route.
 */
export const logAuditAction = ({ actor, ...entry }) => recordAudit({ actorId: actor, ...entry });
