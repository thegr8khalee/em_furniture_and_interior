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

describe('orders', () => {
  const seedAddress = async () => {
    const { rows } = await client.query(
      `INSERT INTO core.addresses (full_name,phone,email,line1,city,state)
       VALUES ('A','1','a@x.com','L','C','S') RETURNING id`
    );
    return rows[0].id;
  };

  const insertOrder = (addr, cols) =>
    client.query(
      `INSERT INTO sales.orders
         (order_number, supabase_user_id, shipping_address_id,
          subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, idempotency_key)
       VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6, $7, $8)`,
      [cols.number, addr, cols.subtotal, cols.discount ?? 0, cols.shipping ?? 0, cols.tax ?? 0, cols.total, cols.key ?? null]
    );

  // Finding F-05: money was taken from the request body. The total now has to
  // be the sum of its parts, so a controller that computes it wrongly fails to
  // insert rather than producing a wrong invoice.
  t('rejects a total that is not the sum of its parts', async () => {
    const addr = await seedAddress();
    await expect(
      insertOrder(addr, { number: 'ORD-A1', subtotal: 100000, tax: 7500, total: 999999 })
    ).rejects.toThrow();
  });

  t('accepts an arithmetically consistent total', async () => {
    const addr = await seedAddress();
    await insertOrder(addr, { number: 'ORD-A2', subtotal: 100000, tax: 7500, total: 107500 });
    expect(true).toBe(true);
  });

  t('rejects a discount larger than the subtotal', async () => {
    const addr = await seedAddress();
    await expect(
      insertOrder(addr, { number: 'ORD-A3', subtotal: 1000, discount: 5000, total: -4000 })
    ).rejects.toThrow();
  });

  // Finding F-06: a double-clicked checkout must not create two orders.
  t('rejects a second order reusing an idempotency key', async () => {
    const addr = await seedAddress();
    await insertOrder(addr, { number: 'ORD-A4', subtotal: 1000, total: 1000, key: 'checkout-x' });
    await expect(
      insertOrder(addr, { number: 'ORD-A5', subtotal: 1000, total: 1000, key: 'checkout-x' })
    ).rejects.toThrow();
  });
});

describe('inventory', () => {
  let itemId;
  let locationId;

  const setup = async () => {
    const { rows: i } = await client.query(
      "INSERT INTO catalog.sellable_items (kind) VALUES ('product') RETURNING id"
    );
    itemId = i[0].id;
    const { rows: l } = await client.query(
      `INSERT INTO inv.locations (name, kind) VALUES ('WH-' || gen_random_uuid()::text, 'warehouse') RETURNING id`
    );
    locationId = l[0].id;
  };

  // Finding F-02: stock was a mutable number nothing decremented. A mutable
  // counter cannot be audited or explained; an append-only log can.
  t('rejects editing or deleting a stock movement', async () => {
    await setup();
    await client.query(
      `INSERT INTO inv.stock_movements (sellable_item_id, location_id, kind, quantity)
       VALUES ($1,$2,'goods_receipt',10)`,
      [itemId, locationId]
    );
    expect(await rejects('UPDATE inv.stock_movements SET quantity = 999')).toBe(true);
    expect(await rejects('DELETE FROM inv.stock_movements')).toBe(true);
  });

  t('rejects a zero-quantity movement', async () => {
    await setup();
    expect(
      await rejects(
        `INSERT INTO inv.stock_movements (sellable_item_id, location_id, kind, quantity)
         VALUES ($1,$2,'count_adjustment',0)`,
        [itemId, locationId]
      )
    ).toBe(true);
  });

  t('derives available stock as on_hand minus live reservations', async () => {
    await setup();
    await client.query(
      `INSERT INTO inv.stock_movements (sellable_item_id, location_id, kind, quantity)
       VALUES ($1,$2,'goods_receipt',10), ($1,$2,'sale_dispatch',-3)`,
      [itemId, locationId]
    );
    await client.query(
      `INSERT INTO inv.reservations (sellable_item_id, location_id, quantity) VALUES ($1,$2,2)`,
      [itemId, locationId]
    );

    const { rows } = await client.query(
      'SELECT on_hand, reserved, available FROM inv.stock_available WHERE sellable_item_id = $1',
      [itemId]
    );
    expect(rows[0]).toMatchObject({ on_hand: '7', reserved: '2', available: '5' });
  });

  t('rejects a stock take approved by whoever counted it', async () => {
    await setup();
    const { rows } = await client.query(
      `INSERT INTO core.staff (supabase_user_id, email, username, role)
       VALUES (gen_random_uuid(), 'counter-' || gen_random_uuid()::text || '@x.com', 'c', 'warehouse_officer')
       RETURNING id`
    );
    expect(
      await rejects(
        'INSERT INTO inv.stock_takes (location_id, counted_by, approved_by) VALUES ($1,$2,$2)',
        [locationId, rows[0].id]
      )
    ).toBe(true);
  });
});

describe('documents', () => {
  // Finding F-07: quotations and invoices were rendered and discarded.
  t('numbers gaplessly, returning the number on rollback', async () => {
    const take = async () => {
      const { rows } = await client.query("SELECT fin.next_document_number('invoice', 2099) AS n");
      return rows[0].n;
    };

    expect(await take()).toBe('INV-2099-0001');
    expect(await take()).toBe('INV-2099-0002');

    // A sequence would burn 0003 here. The counter row returns it.
    await client.query('BEGIN');
    await take();
    await client.query('ROLLBACK');

    expect(await take()).toBe('INV-2099-0003');
  });

  t('rejects an unknown document type', async () => {
    expect(await rejects("SELECT fin.next_document_number('sticker', 2099)")).toBe(true);
  });

  t('rejects repricing or un-issuing a sent document', async () => {
    await client.query(
      `INSERT INTO fin.documents (doc_type, number, status, client_name, total_minor)
       VALUES ('invoice','INV-TEST-1','sent','Ada',50000)`
    );
    expect(
      await rejects("UPDATE fin.documents SET total_minor = 1 WHERE number = 'INV-TEST-1'")
    ).toBe(true);
    expect(
      await rejects("UPDATE fin.documents SET status = 'draft' WHERE number = 'INV-TEST-1'")
    ).toBe(true);
  });

  t('requires a credit note to name the invoice it reverses', async () => {
    expect(
      await rejects(
        `INSERT INTO fin.documents (doc_type, number, client_name, total_minor)
         VALUES ('credit_note','CN-TEST-1','Ada',100)`
      )
    ).toBe(true);
  });
});

describe('segregation of duties', () => {
  const staff = async (role) => {
    const { rows } = await client.query(
      `INSERT INTO core.staff (supabase_user_id, email, username, role)
       VALUES (gen_random_uuid(), gen_random_uuid()::text || '@x.com', 'u', $1) RETURNING id`,
      [role]
    );
    return rows[0].id;
  };

  // The first control an auditor asks about, enforced by the database rather
  // than trusted to a service. It holds for every role, super_admin included.
  t('rejects an expense approved by the person who raised it', async () => {
    const person = await staff('accountant');
    expect(
      await rejects(
        `INSERT INTO fin.expenses (reference, description, amount_minor, spent_on, status, raised_by, approved_by)
         VALUES ('EXP-SELF-' || gen_random_uuid()::text, 'x', 1000, current_date, 'approved', $1, $1)`,
        [person]
      )
    ).toBe(true);
  });

  t('accepts an expense approved by someone else', async () => {
    const raiser = await staff('sales_officer');
    const approver = await staff('accountant');
    await client.query(
      `INSERT INTO fin.expenses (reference, description, amount_minor, spent_on, status, raised_by, approved_by)
       VALUES ('EXP-OK-' || gen_random_uuid()::text, 'x', 1000, current_date, 'approved', $1, $2)`,
      [raiser, approver]
    );
    expect(true).toBe(true);
  });

  t('rejects an approved expense with no approver recorded', async () => {
    expect(
      await rejects(
        `INSERT INTO fin.expenses (reference, description, amount_minor, spent_on, status)
         VALUES ('EXP-NONE-' || gen_random_uuid()::text, 'x', 1000, current_date, 'approved')`
      )
    ).toBe(true);
  });

  t('rejects a variation order approved by its requester', async () => {
    const person = await staff('sales_officer');
    const { rows } = await client.query(
      `INSERT INTO crm.projects (reference, title) VALUES ('PRJ-' || gen_random_uuid()::text, 'T') RETURNING id`
    );
    expect(
      await rejects(
        `INSERT INTO crm.variation_orders (project_id, description, amount_minor, requested_by, approved_by)
         VALUES ($1, 'more work', 5000, $2, $2)`,
        [rows[0].id, person]
      )
    ).toBe(true);
  });
});

describe('activity log retention', () => {
  // PostgreSQL has no TTL index. Retention is a partition drop, which is far
  // cheaper than a mass DELETE and does not bloat the table.
  t('drops only partitions entirely older than the cutoff', async () => {
    await client.query("SELECT core.ensure_activity_partition('2020-01-15')");
    await client.query('SELECT core.ensure_activity_partition(now()::date)');

    const partitions = async () => {
      const { rows } = await client.query(`
        SELECT count(*)::int AS n
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_inherits i ON i.inhrelid = c.oid
         WHERE n.nspname = 'core' AND c.relkind = 'r'
           AND i.inhparent = 'core.activity_logs'::regclass
      `);
      return rows[0].n;
    };

    const before = await partitions();
    const { rows } = await client.query('SELECT core.drop_activity_partitions_older_than(90) AS dropped');
    expect(rows[0].dropped).toBeGreaterThanOrEqual(1);
    expect(await partitions()).toBeLessThan(before);

    // The current month must survive.
    const { rows: current } = await client.query(`
      SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'core' AND c.relkind = 'r'
         AND c.relname = 'activity_logs_' || to_char(now(), 'YYYY_MM')
    `);
    expect(current[0].n).toBe(1);
  });

  // The first version of this function matched on relname LIKE 'activity_logs_%',
  // which also matches every index on every partition — it would have tried to
  // DROP TABLE an index.
  t('ignores the indexes on its partitions', async () => {
    await client.query('SELECT core.ensure_activity_partition(now()::date)');
    const { rows } = await client.query(`
      SELECT count(*)::int AS n
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'core' AND c.relname LIKE 'activity_logs_%' AND c.relkind = 'i'
    `);
    expect(rows[0].n).toBeGreaterThan(0);            // indexes do match the name pattern
    await client.query('SELECT core.drop_activity_partitions_older_than(90)');  // must not throw
  });
});
