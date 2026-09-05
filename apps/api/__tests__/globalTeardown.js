import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import { dialectOptionsFor } from '../src/db/sequelize.js';
import { ADMIN_URL } from './helpers/databaseNames.js';

dotenv.config();

/**
 * Leaves the server as it was found.
 *
 * The per-worker databases are dropped as well as the template: against a
 * developer's own server they are clutter, and against a hosted one they are
 * clutter somebody is paying for. Each is dropped with FORCE, since a pooler may
 * still be holding a connection open.
 */
export default async () => {
  const adminUrl = ADMIN_URL();
  const admin = new Sequelize(adminUrl, {
    logging: false,
    dialectOptions: dialectOptionsFor(adminUrl),
  });

  try {
    const [databases] = await admin.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'em\\_test\\_%'`
    );

    for (const { datname } of databases) {
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } catch {
    // A teardown that fails must not turn a green run red. The next run drops
    // whatever is left over anyway.
  } finally {
    await admin.close().catch(() => {});
  }
};
