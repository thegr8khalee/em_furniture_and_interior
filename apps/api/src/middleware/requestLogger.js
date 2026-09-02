import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger, requestContext } from '../lib/logger.js';

// An inbound x-request-id lets a trace span the frontend and the API, but it is
// attacker-controlled: bound the length and the alphabet so it can't be used to
// forge log lines or bloat every record.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

const resolveRequestId = (req) => {
  const supplied = req.headers['x-request-id'];
  return typeof supplied === 'string' && SAFE_REQUEST_ID.test(supplied)
    ? supplied
    : randomUUID();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: resolveRequestId,

  // Platform health probes poll constantly; logging each one buries real traffic.
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.originalUrl} ${res.statusCode} — ${err.message}`,
});

/**
 * Binds the request id into AsyncLocalStorage for the life of the request, and
 * echoes it back so support can quote the id from a failed request and find the
 * exact log line.
 */
export const withRequestContext = (req, res, next) => {
  res.setHeader('x-request-id', req.id);
  requestContext.run({ requestId: req.id }, next);
};
