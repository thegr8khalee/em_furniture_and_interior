import { Sequelize } from 'sequelize';
import { logger } from '../lib/logger.js';

/**
 * Two connection strings, not one.
 *
 * Supabase offers a transaction-mode pooler (port 6543) and a direct connection
 * (5432). The application runs through the pooler — it is what survives many
 * short-lived serverless-style connections. Migrations must not: transaction
 * pooling gives no session state, so advisory locks silently do nothing and
 * `SET`-based DDL behaves differently. Conflating the two fails at the worst
 * possible moment, halfway through a schema change.
 */
const APP_URL = () => process.env.DATABASE_URL;
const DIRECT_URL = () => process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * TLS for anything that is not on this machine.
 *
 * This used to key off NODE_ENV, which is wrong in both directions: pointing a
 * development shell at the hosted database failed to connect at all (Supabase
 * requires TLS), and it would have been a plaintext connection over the public
 * internet if it had succeeded. The host is what decides.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const needsTls = (url) => {
  try {
    return !LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    // An unparseable URL is the connection's problem, not this function's.
    return true;
  }
};

/** Exported so the test harness's own admin connection makes the same choice. */
export const dialectOptionsFor = (url) =>
  needsTls(url) ? { ssl: { require: true, rejectUnauthorized: false } } : {};

const baseOptions = (url) => ({
  dialect: 'postgres',
  logging: (sql, timing) => logger.debug({ sql, timing }, 'sequelize'),
  benchmark: true,
  define: {
    // Postgres folds unquoted identifiers to lower case; snake_case columns keep
    // hand-written SQL and Sequelize agreeing on names.
    underscored: true,
    freezeTableName: true,
    timestamps: true,
  },
  // rejectUnauthorized stays false because the managed endpoints present a
  // chain this process has no CA bundle for. It buys encryption, not identity.
  dialectOptions: dialectOptionsFor(url),
});

let appInstance = null;

/** The connection the application serves requests on. Pooled. */
export const getSequelize = () => {
  if (appInstance) return appInstance;

  const url = APP_URL();
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  appInstance = new Sequelize(url, {
    ...baseOptions(url),
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: 0,
      idle: 10000,
      acquire: 30000,
    },
  });

  return appInstance;
};

/**
 * A single-connection handle on the direct (non-pooled) endpoint, for
 * migrations only. Callers must close it.
 */
export const createDirectConnection = () => {
  const url = DIRECT_URL();
  if (!url) {
    throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) is not set');
  }

  if (isProduction() && !process.env.DIRECT_DATABASE_URL) {
    logger.warn(
      'DIRECT_DATABASE_URL is not set — running migrations through the pooler, where advisory locks do not hold'
    );
  }

  return new Sequelize(url, { ...baseOptions(url), pool: { max: 1, min: 0 } });
};

export const closeSequelize = async () => {
  if (appInstance) {
    await appInstance.close();
    appInstance = null;
  }
};
