import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * Connects to MongoDB, or throws.
 *
 * This deliberately does not swallow its error. A server that binds the port
 * without a database looks healthy to the platform while 500ing every request,
 * which is the worst of both worlds: no traffic served, no alarm raised.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  const conn = await mongoose.connect(uri, {
    // Fail fast on startup rather than hanging for the 30s default — the
    // process exits and the platform restarts it, which is the faster recovery.
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 10000,
  });

  logger.info({ host: conn.connection.host }, 'Database connected');

  // Losing the connection after startup must not be silent. Readiness reflects
  // it (see /readyz) so a load balancer can drain this instance.
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'Database connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('Database disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('Database reconnected');
  });

  return conn;
};
