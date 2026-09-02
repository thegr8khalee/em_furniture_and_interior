import { AsyncLocalStorage } from 'async_hooks';
import pino from 'pino';

/**
 * Carries the current request's id, so that any `logger.*` call is attributable
 * to the request that triggered it — including calls from helpers several
 * frames deep that never see `req`. Read by the `mixin` below.
 */
export const requestContext = new AsyncLocalStorage();

const isProduction = process.env.NODE_ENV === 'production';

// Human-readable locally, newline-delimited JSON in production so Render's log
// search can actually query it. Set LOG_FORMAT=json to get JSON in development
// (and to avoid needing pino-pretty, which is a devDependency).
const pretty = !isProduction && process.env.LOG_FORMAT !== 'json';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Anything that could carry a credential, a session, or a customer's personal
  // data. Redaction is cheap; a leaked cookie in a log aggregator is not.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-paystack-signature"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.passwordResetToken',
      '*.proofData',
      '*.secret',
      '*.token',
    ],
    censor: '[redacted]',
  },

  mixin() {
    const store = requestContext.getStore();
    return store?.requestId ? { requestId: store.requestId } : {};
  },

  ...(pretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export default logger;
