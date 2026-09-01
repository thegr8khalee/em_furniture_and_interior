import { jest } from '@jest/globals';
import pg from 'pg';
import { applyPending } from '../../src/db/migrate.js';

/**
 * Schema constraints, against a real PostgreSQL.
 *
 * These assert what the DATABASE rejects, not what the application avoids
 * doing. That distinction is the whole reason for moving to Postgres: under
 * concurrency, "the service always writes balanced entries" is a hope, while a
 * deferred constraint trigger is a guarantee.
 *
 * Skipped when no Postgres is configured, so the rest of the suite still runs
 * on a machine without one.
 */

const URL = process.env.TEST_DATABASE_URL || 'postgresql://em:em@127.0.0.1:5432/em_test';

/**
 * Availability is probed at module load, with top-level await, NOT in beforeAll.
 * Jest registers tests during collection, which happens before any hook runs —
 * so a `beforeAll` that sets a flag cannot influence whether tests are skipped.
 * Getting that wrong silently skips the entire suite while reporting success,
 * which is exactly the failure mode finding F-04 was about.
 */
const probe = new pg.Client({ connectionString: URL, connectionTimeoutMillis: 3000 });
const available = await probe
  .connect()
  .then(() => probe.end().then(() => true))
  .catch(() => false);

if (!available) {
  console.warn(`No PostgreSQL at ${URL.replace(/:[^@]*@/, ':***@')} — schema tests skipped.`);
}

let client;

const rejects = async (sql, params = []) => {
  try {
    await client.query(sql, params);
    return false;
  } catch {
    return true;
  }
};

beforeAll(async () => {
  if (!available) return;
  client = new pg.Client({ connectionString: URL, connectionTimeoutMillis: 3000 });
  await client.connect();
  // Start from nothing so the suite tests the migrations, not leftovers.
  await client.query('DROP SCHEMA IF EXISTS core, catalog, cms, sales, crm, inv, fin CASCADE');
  await client.query('DROP TABLE IF EXISTS schema_migrations');
  await applyPending(client, { log: () => {} });
}, 60000);

afterAll(async () => {
  if (available) await client.end();
});

const t = (...args) => (available ? test(...args) : test.skip(...args));

describe('migrations', () => {
  t('are idempotent — a second run applies nothing', async () => {
    const results = await applyPending(client, { log: () => {} });
    expect(results.every((r) => r.status === 'already-applied')).toBe(true);
  });

  t('refuse to re-run a migration whose contents changed', async () => {
    await client.query("UPDATE schema_migrations SET checksum = 'tampered' WHERE name = $1", [
      '0001_foundation.sql',
    ]);
    await expect(applyPending(client, { log: () => {} })).rejects.toThrow(/has changed/);
    // Restore so later tests see a consistent state.
    await client.query('DROP SCHEMA IF EXISTS core, catalog, cms, sales, crm, inv, fin CASCADE');
    await client.query('DROP TABLE IF EXISTS schema_migrations');
    await applyPending(client, { log: () => {} });
  });
});

describe('money', () => {
  t('is an integer type, never floating point', async () => {
    const { rows } = await client.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
        FROM pg_attribute a
       WHERE a.attrelid = 'catalog.products'::regclass AND a.attname = 'price_minor'
    `);
    expect(rows[0].type).toBe('core.money_minor');

    const { rows: base } = await client.query(
      "SELECT format_type(t.typbasetype, t.typtypmod) AS base FROM pg_type t WHERE t.typname = 'money_minor'"
    );
    expect(base[0].base).toBe('bigint');
  });
});

describe('catalog', () => {
  const seed = async () => {
    await client.query(
      "INSERT INTO catalog.categories (name, slug) VALUES ('Living Room','living-room') ON CONFLICT DO NOTHING"
    );
    const { rows } = await client.query('SELECT id FROM catalog.categories LIMIT 1');
    return rows[0].id;
  };

  t('accepts a product whose sellable_item declares kind product', async () => {
    const categoryId = await seed();
    await client.query('BEGIN');
    const { rows } = await client.query(
      "INSERT INTO catalog.sellable_items (kind) VALUES ('product') RETURNING id"
    );
    await client.query(
      `INSERT INTO catalog.products (id,name,description,category_id,style,price_minor)
       VALUES ($1,'Chair','x',$2,'Modern',100000)`,
      [rows[0].id, categoryId]
    );
    await client.query('COMMIT');
    expect(true).toBe(true);
  });

  // Without this the supertype buys nothing: a product could hang off an item
  // the rest of the system believes is a collection.
  // The kind check is DEFERRABLE INITIALLY DEFERRED, so it fires at COMMIT, not
  // at INSERT. The failure must therefore be provoked by committing — a test
  // that rolls back first never reaches the constraint and passes vacuously.
  t('rejects a product hanging off a collection sellable_item', async () => {
    const categoryId = await seed();
    let failed = false;
    await client.query('BEGIN');
    try {
      const { rows } = await client.query(
        "INSERT INTO catalog.sellable_items (kind) VALUES ('collection') RETURNING id"
      );
      await client.query(
        `INSERT INTO catalog.products (id,name,description,category_id,style,price_minor)
         VALUES ($1,'Wrong','x',$2,'Modern',1)`,
        [rows[0].id, categoryId]
      );
      await client.query('COMMIT');
    } catch {
      failed = true;
      await client.query('ROLLBACK').catch(() => {});
    }
    expect(failed).toBe(true);
  });

  t('rejects an unknown sellable kind', async () => {
    expect(await rejects("INSERT INTO catalog.sellable_items (kind) VALUES ('service')")).toBe(true);
  });

  // Finding F-12: unique but nullable, or every SKU-less item but the first is
  // rejected.
  t('rejects a duplicate SKU but allows many without one', async () => {
    await client.query("INSERT INTO catalog.sellable_items (kind, sku) VALUES ('product','SKU-UNIQ')");
    expect(
      await rejects("INSERT INTO catalog.sellable_items (kind, sku) VALUES ('product','SKU-UNIQ')")
    ).toBe(true);
    await client.query(
      "INSERT INTO catalog.sellable_items (kind) VALUES ('product'),('product'),('collection')"
    );
  });

  t('rejects a negative price and a discount above list price', async () => {
    const categoryId = await seed();
    const { rows } = await client.query(
      "INSERT INTO catalog.sellable_items (kind) VALUES ('product') RETURNING id"
    );
    expect(
      await rejects(
        `INSERT INTO catalog.products (id,name,description,category_id,style,price_minor)
         VALUES ($1,'Neg','x',$2,'Modern',-1)`,
        [rows[0].id, categoryId]
      )
    ).toBe(true);
    expect(
      await rejects(
        `INSERT INTO catalog.products (id,name,description,category_id,style,price_minor,discount_minor)
         VALUES ($1,'Bad','x',$2,'Modern',1000,2000)`,
        [rows[0].id, categoryId]
      )
    ).toBe(true);
  });
});

describe('ledger', () => {
  let periodId;
  let cash;
  let revenue;

  const setup = async () => {
    await client.query(`
      INSERT INTO fin.accounts (code,name,type)
      VALUES ('1000','Cash','asset'), ('4000','Revenue','revenue')
      ON CONFLICT (code) DO NOTHING
    `);
    const { rows: a } = await client.query("SELECT id, code FROM fin.accounts WHERE code IN ('1000','4000')");
    cash = a.find((r) => r.code === '1000').id;
    revenue = a.find((r) => r.code === '4000').id;

    const { rows: p } = await client.query(`
      INSERT INTO fin.periods (starts_on, ends_on) VALUES ('2026-03-01','2026-03-31')
      ON CONFLICT DO NOTHING RETURNING id
    `);
    periodId = p[0]?.id
      ?? (await client.query("SELECT id FROM fin.periods WHERE starts_on='2026-03-01'")).rows[0].id;
  };

  const postEntry = async (debit, credit) => {
    const { rows } = await client.query(
      `INSERT INTO fin.journal_entries (entry_date, period_id, source_type)
       VALUES ('2026-03-15', $1, 'order') RETURNING id`,
      [periodId]
    );
    const entryId = rows[0].id;
    await client.query(
      `INSERT INTO fin.journal_lines (entry_id, account_id, debit_minor, credit_minor)
       VALUES ($1,$2,$3,0), ($1,$4,0,$5)`,
      [entryId, cash, debit, revenue, credit]
    );
    return entryId;
  };

  t('accepts a balanced entry', async () => {
    await setup();
    await client.query('BEGIN');
    await postEntry(100000, 100000);
    await client.query('COMMIT');
    expect(true).toBe(true);
  });

  // The invariant the whole design rests on.
  t('rejects an entry whose debits and credits differ', async () => {
    await setup();
    await client.query('BEGIN');
    let failed = false;
    try {
      await postEntry(100000, 60000);
      await client.query('COMMIT');
    } catch {
      failed = true;
      await client.query('ROLLBACK');
    }
    expect(failed).toBe(true);
  });

  t('rejects a line that is both a debit and a credit', async () => {
    await setup();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO fin.journal_entries (entry_date, period_id, source_type)
       VALUES ('2026-03-16', $1, 'order') RETURNING id`,
      [periodId]
    );
    const failed = await rejects(
      `INSERT INTO fin.journal_lines (entry_id, account_id, debit_minor, credit_minor)
       VALUES ($1,$2,50,50)`,
      [rows[0].id, cash]
    );
    await client.query('ROLLBACK');
    expect(failed).toBe(true);
  });

  // Posted history is evidence. Corrections are reversing entries.
  t('rejects editing or deleting a posted entry', async () => {
    await setup();
    await client.query('BEGIN');
    await postEntry(5000, 5000);
    await client.query('COMMIT');

    expect(await rejects("UPDATE fin.journal_entries SET memo = 'tampered'")).toBe(true);
    expect(await rejects('DELETE FROM fin.journal_entries')).toBe(true);
  });

  t('rejects a posting dated inside a closed period', async () => {
    await setup();
    await client.query("UPDATE fin.periods SET status='closed' WHERE id=$1", [periodId]);
    const failed = await rejects(
      `INSERT INTO fin.journal_entries (entry_date, period_id, source_type)
       VALUES ('2026-03-20', $1, 'order')`,
      [periodId]
    );
    await client.query("UPDATE fin.periods SET status='open' WHERE id=$1", [periodId]);
    expect(failed).toBe(true);
  });

  t('rejects overlapping accounting periods', async () => {
    await setup();
    expect(
      await rejects("INSERT INTO fin.periods (starts_on, ends_on) VALUES ('2026-03-15','2026-04-15')")
    ).toBe(true);
  });
});
