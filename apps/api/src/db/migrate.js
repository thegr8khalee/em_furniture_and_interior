import crypto from 'crypto';
import path from 'path';
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { QueryTypes } from 'sequelize';
import { createDirectConnection } from './sequelize.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// One arbitrary but fixed key. Two deploys starting at once both try to take it;
// the second waits rather than applying the same DDL concurrently.
const ADVISORY_LOCK_KEY = 8571432190;

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

const ensureMigrationsTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const loadMigrations = async () => {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // numeric prefixes make lexical order the intended order

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: checksum(sql) };
    })
  );
};

/**
 * Applies every pending migration, each in its own transaction.
 *
 * An already-applied migration whose file has since changed is a hard error, not
 * something to reconcile silently: the database and the repository disagreeing
 * about what was applied is not a state to guess at. Fix it with a new
 * migration, never by editing an applied one.
 */
export const runMigrations = async ({ db: provided, silent = false } = {}) => {
  const db = provided || createDirectConnection();
  const ownsConnection = !provided;
  const log = silent ? { info: () => {}, warn: () => {} } : logger;

  try {
    await db.query('SELECT pg_advisory_lock(:key)', {
      replacements: { key: ADVISORY_LOCK_KEY },
    });

    await ensureMigrationsTable(db);

    const applied = await db.query('SELECT name, checksum FROM schema_migrations', {
      type: QueryTypes.SELECT,
    });
    const appliedByName = new Map(applied.map((r) => [r.name, r.checksum]));

    const migrations = await loadMigrations();
    const pending = [];

    for (const migration of migrations) {
      const previous = appliedByName.get(migration.name);
      if (previous === undefined) {
        pending.push(migration);
        continue;
      }
      if (previous !== migration.checksum) {
        throw new Error(
          `Migration ${migration.name} has changed since it was applied. ` +
            'Applied migrations are immutable — add a new migration instead of editing this one.'
        );
      }
    }

    if (pending.length === 0) {
      log.info({ applied: appliedByName.size }, 'Database schema is up to date');
      return { applied: [], alreadyApplied: appliedByName.size };
    }

    const appliedNow = [];
    for (const migration of pending) {
      // Each migration commits on its own, so a failure halfway through a batch
      // leaves the earlier ones applied and recorded rather than half-done.
      await db.transaction(async (transaction) => {
        await db.query(migration.sql, { transaction });
        await db.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES (:name, :checksum)',
          { replacements: migration, transaction }
        );
      });
      appliedNow.push(migration.name);
      log.info({ migration: migration.name }, 'Applied migration');
    }

    return { applied: appliedNow, alreadyApplied: appliedByName.size };
  } finally {
    await db
      .query('SELECT pg_advisory_unlock(:key)', { replacements: { key: ADVISORY_LOCK_KEY } })
      .catch(() => {});
    if (ownsConnection) {
      await db.close();
    }
  }
};

// `npm run migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(({ applied, alreadyApplied }) => {
      logger.info(
        { appliedCount: applied.length, alreadyApplied },
        applied.length ? 'Migrations complete' : 'Nothing to do'
      );
      process.exit(0);
    })
    .catch((err) => {
      logger.fatal({ err }, 'Migration failed');
      process.exit(1);
    });
}
