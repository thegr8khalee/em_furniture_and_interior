import { Sequelize } from 'sequelize';
import { runMigrations } from '../../src/db/migrate.js';

/**
 * A real PostgreSQL for the schema tests.
 *
 * These tests exist to prove the database rejects bad data. A fake or in-memory
 * substitute enforces none of it, so it would report success while testing
 * nothing — the exact failure this whole migration is meant to remove.
 *
 * If no database is reachable, setup throws. It must never skip: a suite that
 * silently skips is indistinguishable from a suite that passes.
 */
const ADMIN_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/postgres';

const databaseName = () =>
  `em_test_${process.env.JEST_WORKER_ID || '1'}`;

const urlFor = (name) => {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
};

let db = null;

export const setupDatabase = async () => {
  const name = databaseName();
  const admin = new Sequelize(ADMIN_URL, { logging: false });

  try {
    await admin.authenticate();
  } catch (error) {
    throw new Error(
      `Schema tests need a real PostgreSQL at ${ADMIN_URL} and could not connect ` +
        `(${error.message}). Start one, or set TEST_DATABASE_URL. These tests do ` +
        'not skip: skipping would report a pass for constraints nobody verified.'
    );
  }

  // Dropped and recreated per run so a failed run cannot leave state that makes
  // the next one pass for the wrong reason.
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.close();

  db = new Sequelize(urlFor(name), { logging: false });
  await runMigrations({ db, silent: true });

  return db;
};

export const teardownDatabase = async () => {
  if (!db) return;
  await db.close();
  db = null;
};

/**
 * The URL of the throwaway database this worker is using.
 *
 * Tests that drive the HTTP app set DATABASE_URL from this before importing
 * app.js, so the service layer's lazily-created connection lands on the test
 * database rather than a developer's real one.
 */
export const currentDatabaseUrl = () => urlFor(databaseName());

export const getDb = () => {
  if (!db) throw new Error('setupDatabase() has not run');
  return db;
};

/**
 * Asserts a statement is rejected by the database, and by the constraint named.
 *
 * Matching the constraint matters: a typo in the test's own SQL would also throw,
 * and would otherwise be mistaken for the constraint doing its job.
 */
export const expectRejection = async (sql, constraintName, replacements = {}) => {
  let error = null;
  try {
    await getDb().query(sql, { replacements });
  } catch (err) {
    error = err;
  }

  if (!error) {
    throw new Error(`Expected the database to reject this, but it was accepted:\n${sql}`);
  }

  const detail = `${error.message} ${error.parent?.message || ''} ${error.parent?.constraint || ''}`;
  if (!detail.includes(constraintName)) {
    throw new Error(
      `Rejected, but not by "${constraintName}" — got: ${detail.trim()}\n${sql}`
    );
  }

  return error;
};

/** Inserts a sellable item plus its subtype row, returning the id. */
export const insertProduct = async (overrides = {}) => {
  const fields = {
    name: 'Milano Sofa',
    description: 'A comfortable sofa',
    style: 'Modern',
    price: 45000000, // ₦450,000 in kobo
    category: 'Sofas',
    ...overrides,
  };

  const [[item]] = await getDb().query(
    `INSERT INTO sellable_items (kind, name, description, style, price, is_promo, discounted_price, is_foreign, origin, cost_price)
     VALUES ('product', :name, :description, :style, :price, :is_promo, :discounted_price, :is_foreign, :origin, :cost_price)
     RETURNING id`,
    {
      replacements: {
        name: fields.name,
        description: fields.description,
        style: fields.style,
        price: fields.price,
        is_promo: fields.is_promo ?? false,
        discounted_price: fields.discounted_price ?? null,
        is_foreign: fields.is_foreign ?? false,
        origin: fields.origin ?? null,
        cost_price: fields.cost_price ?? null,
      },
    }
  );

  await getDb().query(
    `INSERT INTO products (id, category, sku) VALUES (:id, :category, :sku)`,
    {
      replacements: { id: item.id, category: fields.category, sku: fields.sku ?? null },
    }
  );

  return item.id;
};

export const insertCollection = async (overrides = {}) => {
  const [[item]] = await getDb().query(
    `INSERT INTO sellable_items (kind, name, style, price)
     VALUES ('collection', :name, :style, :price) RETURNING id`,
    {
      replacements: {
        name: overrides.name ?? 'Milano Living Set',
        style: overrides.style ?? 'Modern',
        price: overrides.price ?? 120000000,
      },
    }
  );

  await getDb().query('INSERT INTO collections (id) VALUES (:id)', {
    replacements: { id: item.id },
  });

  return item.id;
};

export const insertCustomer = async (overrides = {}) => {
  const [[row]] = await getDb().query(
    `INSERT INTO customers (email, full_name, password_hash)
     VALUES (:email, :name, :hash) RETURNING id`,
    {
      replacements: {
        email: overrides.email ?? `c${Math.random().toString(36).slice(2)}@example.com`,
        name: overrides.full_name ?? 'Ada Obi',
        hash: overrides.password_hash ?? '$2a$10$abcdefghijklmnopqrstuv',
      },
    }
  );
  return row.id;
};

export const insertGuestSession = async () => {
  const [[row]] = await getDb().query(
    `INSERT INTO guest_sessions (anonymous_id) VALUES (:id) RETURNING id`,
    { replacements: { id: `anon-${Math.random().toString(36).slice(2)}` } }
  );
  return row.id;
};

/** An order whose total reconciles, so a test has to opt in to breaking it. */
export const insertOrder = async (overrides = {}) => {
  const customerId = overrides.customerId ?? (await insertCustomer());
  const subtotal = overrides.subtotal ?? 100000;
  const discount = overrides.discount ?? 0;
  const shipping = overrides.shipping ?? 0;
  const tax = overrides.tax ?? 0;

  const [[row]] = await getDb().query(
    `INSERT INTO orders (order_number, customer_id, shipping_address, subtotal, discount,
                         shipping_cost, tax_amount, total_amount, idempotency_key)
     VALUES (:orderNumber, :customerId, '{}', :subtotal, :discount, :shipping, :tax, :total, :key)
     RETURNING id`,
    {
      replacements: {
        orderNumber: overrides.orderNumber ?? `ORD-${Math.random().toString(36).slice(2, 10)}`,
        customerId,
        subtotal,
        discount,
        shipping,
        tax,
        total: subtotal - discount + shipping + tax,
        key: overrides.idempotencyKey ?? null,
      },
    }
  );
  return row.id;
};

export const recordMovement = async (productId, quantity, reason, extra = {}) => {
  const [[row]] = await getDb().query(
    `INSERT INTO stock_movements (product_id, quantity, reason, order_id, note)
     VALUES (:productId, :quantity, :reason, :orderId, :note) RETURNING id`,
    {
      replacements: {
        productId,
        quantity,
        reason,
        orderId: extra.orderId ?? null,
        note: extra.note ?? null,
      },
    }
  );
  return row.id;
};

export const stockOf = async (productId) => {
  const [[row]] = await getDb().query(
    `SELECT on_hand, reserved, available, is_low FROM product_availability WHERE product_id = :id`,
    { replacements: { id: productId } }
  );
  return row;
};
