import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import { runMigrations } from '../src/db/migrate.js';
import { dialectOptionsFor } from '../src/db/sequelize.js';
import { ADMIN_URL, TEMPLATE_DATABASE, urlFor } from './helpers/databaseNames.js';

dotenv.config();

/**
 * Builds the schema once, for every worker to copy.
 *
 * Each suite needs its own database — they insert conflicting rows and truncate
 * tables out from under each other otherwise — and each used to get one by
 * applying all nine migrations to it. That is a couple of seconds against a
 * local server and thirty against a hosted one, multiplied by the number of
 * suites, and it grew until suites started timing out in `beforeAll`.
 *
 * `CREATE DATABASE ... TEMPLATE` is a file copy. The migrations run once here,
 * and every worker's database is stamped out of the result — which also means
 * every worker is provably running the same schema.
 */
export default async () => {
  const admin = new Sequelize(ADMIN_URL(), {
    logging: false,
    dialectOptions: dialectOptionsFor(ADMIN_URL()),
  });

  try {
    await admin.authenticate();
  } catch (error) {
    throw new Error(
      `These tests need a real PostgreSQL at ${ADMIN_URL()} and could not connect ` +
        `(${error.message}). Start one, or set TEST_DATABASE_URL. They do not skip: ` +
        'skipping would report a pass for constraints nobody verified.'
    );
  }

  // FORCE because a connection pooler keeps server connections warm after the
  // client has gone, so the previous run's session may still be attached.
  await admin.query(`DROP DATABASE IF EXISTS "${TEMPLATE_DATABASE}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${TEMPLATE_DATABASE}"`);
  await admin.close();

  const url = urlFor(TEMPLATE_DATABASE);
  const db = new Sequelize(url, { logging: false, dialectOptions: dialectOptionsFor(url) });

  await runMigrations({ db, silent: true });

  await db.close();

  // Closing the client is not enough behind a connection pooler: it keeps the
  // server connection warm, so the template still has a session attached and
  // `CREATE DATABASE ... TEMPLATE` fails for every worker with "source database
  // is being accessed by other users". Nothing may be connected to a template
  // while it is copied, so anything still attached is ended here.
  const closer = new Sequelize(ADMIN_URL(), {
    logging: false,
    dialectOptions: dialectOptionsFor(ADMIN_URL()),
  });

  await closer.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = :template AND pid <> pg_backend_pid()`,
    { replacements: { template: TEMPLATE_DATABASE } }
  );
  await closer.close();
};
