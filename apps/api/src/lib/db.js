import { getSequelize } from '../db/sequelize.js';
import { logger } from './logger.js';

/**
 * Connects to PostgreSQL, or throws.
 *
 * This deliberately does not swallow its error. A server that binds the port
 * without a database looks healthy to the platform while 500ing every request,
 * which is the worst of both worlds: no traffic served, no alarm raised.
 */
export const connectDB = async () => {
  const db = getSequelize();

  await db.authenticate();

  const [{ server }] = await db.query('SELECT current_setting(:setting) AS server', {
    replacements: { setting: 'server_version' },
    type: 'SELECT',
  });

  logger.info({ postgres: server }, 'Database connected');

  return db;
};

/**
 * Whether the database can answer right now.
 *
 * Readiness asks this on every probe, so it is a single trivial round trip and
 * not a pool-exhausting one.
 */
export const databaseIsReachable = async () => {
  try {
    await getSequelize().query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database is not reachable');
    return false;
  }
};
