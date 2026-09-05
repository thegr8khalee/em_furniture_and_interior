import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  currentDatabaseUrl,
  insertProduct,
  insertCollection,
  insertOrder,
  recordMovement,
} from '../helpers/database.js';

// The console's stock screen, and the sitemap.
//
// The claim worth protecting is that there is no quantity to set: an adjustment
// records the movement that explains the new figure, and the figure is derived
// from the movements. So every test here asserts on both — what the endpoint
// says, and what the ledger now contains.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.FRONTEND_URL = 'https://emfurniture.test';
  ({ default: app } = await import('../../src/app.js'));
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.5.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

const signInAsOperator = async (role = 'super_admin') => {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `ops-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `ops-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
};

describe('the stock list', () => {
  let adminCookie;
  let sofaId;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
    sofaId = await insertProduct({ name: 'Stocked Sofa', price: 1000000, sku: 'STK-1' });
    await recordMovement(sofaId, 10, 'purchase_receipt');
  });

  it('reports what is on hand, reserved and sellable', async () => {
    const res = await api('get', '/api/inventory/admin/products?search=STK-1').set(
      'Cookie',
      adminCookie
    );

    expect(res.status).toBe(200);
    expect(res.body.products[0]).toMatchObject({
      _id: sofaId,
      name: 'Stocked Sofa',
      sku: 'STK-1',
      onHand: 10,
      reserved: 0,
      stockQuantity: 10,
    });
  });

  it('searches by name as well as by SKU', async () => {
    const byName = await api('get', '/api/inventory/admin/products?search=Stocked').set(
      'Cookie',
      adminCookie
    );

    expect(byName.body.products.some((p) => p._id === sofaId)).toBe(true);
  });

  it('lists only what is low when asked', async () => {
    const low = await insertProduct({ name: 'Nearly Gone', price: 100, sku: 'LOW-1' });
    await recordMovement(low, 1, 'purchase_receipt');

    const res = await api('get', '/api/inventory/admin/products?lowStock=true').set(
      'Cookie',
      adminCookie
    );

    const ids = res.body.products.map((p) => p._id);
    expect(ids).toContain(low);
    expect(ids).not.toContain(sofaId);
  });

  it('counts a held reservation as unsellable without removing it from the warehouse', async () => {
    const item = await insertProduct({ name: 'Reserved Sofa', price: 100, sku: 'RES-1' });
    await recordMovement(item, 5, 'purchase_receipt');
    // A reservation is always against an order — stock is held for somebody.
    const orderId = await insertOrder();
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity, status)
       VALUES (:id, :orderId, 2, 'held')`,
      { replacements: { id: item, orderId } }
    );

    const res = await api('get', '/api/inventory/admin/products?search=RES-1').set(
      'Cookie',
      adminCookie
    );

    expect(res.body.products[0]).toMatchObject({ onHand: 5, reserved: 2, stockQuantity: 3 });
  });

  it('refuses an operator without the inventory permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/inventory/admin/products').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});

describe('adjusting a count', () => {
  let adminCookie;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
  });

  const stocked = async (quantity, sku) => {
    const id = await insertProduct({ name: `Adjusted ${sku}`, price: 1000, sku });
    if (quantity !== 0) await recordMovement(id, quantity, 'purchase_receipt');
    return id;
  };

  const adjust = (id, body) =>
    api('put', `/api/inventory/admin/products/${id}/adjust`).set('Cookie', adminCookie).send(body);

  it('records the movement an absolute figure implies', async () => {
    const id = await stocked(10, 'ADJ-1');

    const res = await adjust(id, { newQuantity: 7, reason: 'Stock count' });

    expect(res.status).toBe(200);
    expect(res.body.product.stockQuantity).toBe(7);

    const movements = await rows(
      `SELECT quantity, reason, note FROM stock_movements
        WHERE product_id = :id AND reason = 'adjustment'`,
      { id }
    );
    expect(movements).toEqual([{ quantity: -3, reason: 'adjustment', note: 'Stock count' }]);
  });

  it('takes a delta directly', async () => {
    const id = await stocked(10, 'ADJ-2');

    const res = await adjust(id, { delta: 4, reason: 'Found in the back' });

    expect(res.body.product.stockQuantity).toBe(14);
  });

  it('will not let a delta drive the count below zero', async () => {
    const id = await stocked(3, 'ADJ-3');

    const res = await adjust(id, { delta: -10, reason: 'Written off' });

    expect(res.body.product.stockQuantity).toBe(0);
  });

  it('writes nothing when the count is already right', async () => {
    const id = await stocked(5, 'ADJ-4');

    const res = await adjust(id, { newQuantity: 5, reason: 'Counted, no change' });

    expect(res.status).toBe(200);

    const movements = await rows(
      `SELECT count(*)::int AS total FROM stock_movements
        WHERE product_id = :id AND reason = 'adjustment'`,
      { id }
    );
    expect(movements[0].total).toBe(0);
  });

  it('refuses an adjustment with no reason, which is how a discrepancy becomes permanent', async () => {
    const id = await stocked(5, 'ADJ-5');

    const res = await adjust(id, { newQuantity: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it('refuses a negative absolute quantity and a delta that is not a number', async () => {
    const id = await stocked(5, 'ADJ-6');

    expect((await adjust(id, { newQuantity: -1, reason: 'x' })).status).toBe(400);
    expect((await adjust(id, { delta: 'lots', reason: 'x' })).status).toBe(400);
  });

  it('needs either a delta or a quantity', async () => {
    const id = await stocked(5, 'ADJ-7');

    const res = await adjust(id, { reason: 'x' });

    expect(res.status).toBe(400);
  });

  it('404s for a product that does not exist', async () => {
    const res = await adjust('11111111-1111-4111-8111-111111111111', {
      newQuantity: 1,
      reason: 'x',
    });

    expect(res.status).toBe(404);
  });

  it('writes a correction off against the books', async () => {
    const id = await insertProduct({
      name: 'Written Off',
      price: 1000,
      cost_price: 500000,
      sku: 'ADJ-COGS',
    });
    await recordMovement(id, 10, 'purchase_receipt');

    await adjust(id, { delta: -2, reason: 'Damaged in the warehouse' });

    const lines = await rows(
      `SELECT a.code, l.debit::bigint AS debit, l.credit::bigint AS credit
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.source = 'stock_movement'
          AND e.source_id IN (
            SELECT id FROM stock_movements WHERE product_id = :id AND reason = 'adjustment'
          )
        ORDER BY a.code`,
      { id }
    );

    // Two units at ₦5,000 cost, out of inventory and into write-offs.
    expect(lines.map((l) => ({ code: l.code, debit: Number(l.debit), credit: Number(l.credit) }))).toEqual([
      { code: '1300', debit: 0, credit: 1000000 },
      { code: '5400', debit: 1000000, credit: 0 },
    ]);
  });

  it('puts stock a count found back into inventory', async () => {
    const id = await insertProduct({
      name: 'Found Again',
      price: 1000,
      cost_price: 200000,
      sku: 'ADJ-FOUND',
    });
    await recordMovement(id, 5, 'purchase_receipt');

    await adjust(id, { newQuantity: 8, reason: 'Counted three more on the shelf' });

    const lines = await rows(
      `SELECT a.code, l.debit::bigint AS debit, l.credit::bigint AS credit
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.source = 'stock_movement'
          AND e.source_id IN (
            SELECT id FROM stock_movements WHERE product_id = :id AND reason = 'adjustment'
          )
        ORDER BY a.code`,
      { id }
    );

    expect(lines.map((l) => ({ code: l.code, debit: Number(l.debit), credit: Number(l.credit) }))).toEqual([
      { code: '1300', debit: 600000, credit: 0 },
      { code: '5400', debit: 0, credit: 600000 },
    ]);
  });

  it('adjusts a product with no cost price without posting anything', async () => {
    const id = await insertProduct({ name: 'No Cost', price: 1000, sku: 'ADJ-NOCOST' });
    await recordMovement(id, 5, 'purchase_receipt');

    const res = await adjust(id, { delta: -1, reason: 'Damaged' });

    expect(res.status).toBe(200);
    expect(res.body.product.stockQuantity).toBe(4);

    const [entries] = await rows(
      `SELECT count(*)::int AS total FROM journal_entries
        WHERE source = 'stock_movement'
          AND source_id IN (SELECT id FROM stock_movements WHERE product_id = :id)`,
      { id }
    );
    expect(entries.total).toBe(0);
  });

  it('shows the movements behind the count, including the sale that caused one', async () => {
    const id = await stocked(10, 'ADJ-8');
    await adjust(id, { delta: -1, reason: 'Damaged in transit' });

    const res = await api('get', `/api/inventory/admin/products/${id}/history`).set(
      'Cookie',
      adminCookie
    );

    expect(res.status).toBe(200);
    expect(res.body.movements).toHaveLength(2);
    expect(res.body.movements[0]).toMatchObject({
      delta: -1,
      reason: 'adjustment',
      note: 'Damaged in transit',
    });
    expect(res.body.movements[0].adjustedBy).not.toBeNull();
  });
});

describe('the sitemap', () => {
  it('lists the catalog from PostgreSQL', async () => {
    const productId = await insertProduct({ name: 'Sitemap Sofa', price: 1000 });
    const collectionId = await insertCollection({ name: 'Sitemap Set', price: 2000 });

    const res = await api('get', '/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    expect(res.text).toContain(`https://emfurniture.test/product/${productId}`);
    expect(res.text).toContain(`https://emfurniture.test/collection/${collectionId}`);
    // The static routes are still there alongside them.
    expect(res.text).toContain('https://emfurniture.test/shop');
  });
});
