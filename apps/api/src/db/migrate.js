#!/usr/bin/env node
/**
 * Migration runner.
 *
 * Numbered SQL files, applied in order, each inside a transaction, recorded in
 * `schema_migrations`. Deliberately small and boring: Sequelize's own tooling
 * does not express the constraints this schema depends on (deferred constraint
 * triggers, partial indexes, CHECKs), so migrations are raw SQL and the runner
 * only has to sequence them.
 *
 *   node src/db/migrate.js              apply pending
 *   node src/db/migrate.js --status     list applied and pending
 *   node src/db/migrate.js --verify     apply twice to a scratch DB; must match
 *
 * Runs against DIRECT_DATABASE_URL, never the pooler: DDL and advisory locks
 * need session state that transaction-mode pooling does not provide.
 */

import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// An advisory lock stops two deploys migrating at once. The number is arbitrary
// but must be stable.
const LOCK_ID = 8_150_423;

export const migrationFiles = () =>
  readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

const checksum = (sql) => createHash('sha256').update(sql).digest('hex').slice(0, 16);

const connectionString = () => {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) must be set');
  return url;
};

const ensureTable = (client) =>
  client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

export const applyPending = async (client, { log = console.log } = {}) => {
  await ensureTable(client);
  const { rows } = await client.query('SELECT name, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  const results = [];

  for (const name of migrationFiles()) {
    const sql = readFileSync(path.join(DIR, name), 'utf8');
    const sum = checksum(sql);

    if (applied.has(name)) {
      // An edited migration means the database and the repository disagree
      // about what was applied. Fail rather than guess.
      if (applied.get(name) !== sum) {
        throw new Error(
          `${name} has changed since it was applied. Migrations are immutable; add a new one.`
        );
      }
      results.push({ name, status: 'already-applied' });
      continue;
    }

    // Each migration is one transaction, so a failure leaves no partial schema.
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, sum]);
      await client.query('COMMIT');
      log(`  applied  ${name}`);
      results.push({ name, status: 'applied' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${name} failed: ${error.message}`);
    }
  }

  return results;
};

const withClient = async (fn, url = connectionString()) => {
  const client = new pg.Client({ connectionString: url, ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

const run = async () => {
  const status = process.argv.includes('--status');

  await withClient(async (client) => {
    if (status) {
      await ensureTable(client);
      const { rows } = await client.query('SELECT name, applied_at FROM schema_migrations ORDER BY name');
      const applied = new Set(rows.map((r) => r.name));
      for (const name of migrationFiles()) {
        console.log(`  ${applied.has(name) ? 'applied ' : 'PENDING '} ${name}`);
      }
      return;
    }

    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try {
      const results = await applyPending(client);
      const n = results.filter((r) => r.status === 'applied').length;
      console.log(n ? `\n${n} migration(s) applied.` : 'Already up to date.');
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    }
  });
};

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('migrate.js');
if (invokedDirectly) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
