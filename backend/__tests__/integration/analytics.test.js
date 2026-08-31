import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Admin from '../../src/models/admin.model.js';
import Order from '../../src/models/order.model.js';
import Product from '../../src/models/product.model.js';
import Collection from '../../src/models/collection.model.js';
import {
  buildTestApp,
  connectTestDb,
  closeTestDb,
  clearCollections,
} from '../helpers/testApp.js';

/**
 * Analytics aggregation correctness (finding F-08).
 *
 * The bug these guard against: aggregations that $unwind the items array and
 * then count with $sum: 1 are counting LINE ITEMS, not orders. A three-line
 * order inflated its category's order count threefold.
 */

let app;
let adminCookie;

const address = {
  fullName: 'Ada Obi',
  phone: '+2348012345678',
  email: 'ada@example.com',
  address: '12 Awolowo Road',
  city: 'Ikoyi',
  state: 'Lagos',
  country: 'Nigeria',
};

const makeProduct = (name, category, price) =>
  Product.create({
    name,
    description: 'x',
    items: 'x',
    price,
    category,
    style: 'Modern',
    images: [{ url: 'https://example.com/a.jpg' }],
  });

/** A paid, non-cancelled order — the only kind the reports count. */
const makePaidOrder = (lines) =>
  Order.create({
    items: lines.map((l) => ({
      item: l.id,
      itemType: l.itemType ?? 'Product',
      name: l.name,
      price: l.price,
      quantity: l.quantity,
      subtotal: l.price * l.quantity,
    })),
    shippingAddress: address,
    subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    totalAmount: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    status: 'confirmed',
    paymentStatus: 'paid',
    isGuestOrder: true,
  });

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDb();
  app = buildTestApp();
}, 120000);

afterAll(async () => closeTestDb());

beforeEach(async () => {
  await clearCollections();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  const admin = await Admin.create({
    username: 'root',
    email: 'root@example.com',
    passwordHash: 'x',
    role: 'super_admin',
  });
  const token = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET);
  adminCookie = [`jwt=${token}`];
});

afterEach(() => jest.restoreAllMocks());

const get = (path) => request(app).get(path).set('Cookie', adminCookie);

describe('sales by category (F-08)', () => {
  test('counts orders, not line items', async () => {
    const a = await makeProduct('Sofa', 'Living Room', 100000);
    const b = await makeProduct('Lamp', 'Living Room', 20000);
    const c = await makeProduct('Rug', 'Living Room', 30000);

    // ONE order with THREE lines, all in the same category.
    await makePaidOrder([
      { id: a._id, name: 'Sofa', price: 100000, quantity: 1 },
      { id: b._id, name: 'Lamp', price: 20000, quantity: 2 },
      { id: c._id, name: 'Rug', price: 30000, quantity: 1 },
    ]);

    const res = await get('/api/analytics/sales/category');

    expect(res.status).toBe(200);
    const living = res.body.data.find((row) => row._id === 'Living Room');
    expect(living.orderCount).toBe(1);   // was 3 before the fix
    expect(living.itemCount).toBe(4);    // units, which was always right
    expect(living.totalRevenue).toBe(170000);
  });

  test('counts each order once across separate orders', async () => {
    const p = await makeProduct('Sofa', 'Living Room', 100000);
    await makePaidOrder([{ id: p._id, name: 'Sofa', price: 100000, quantity: 1 }]);
    await makePaidOrder([{ id: p._id, name: 'Sofa', price: 100000, quantity: 1 }]);

    const res = await get('/api/analytics/sales/category');
    const living = res.body.data.find((row) => row._id === 'Living Room');
    expect(living.orderCount).toBe(2);
  });

  // Collections previously fell through the products-only lookup into an
  // unnamed null bucket, taking their revenue with them.
  test('attributes Collection line items instead of dropping them', async () => {
    const product = await makeProduct('Sofa', 'Living Room', 100000);
    const collection = await Collection.create({
      name: 'Bedroom Suite',
      description: 'x',
      price: 500000,
      style: 'Modern',
      images: [{ url: 'https://example.com/c.jpg' }],
    });

    await makePaidOrder([
      { id: product._id, name: 'Sofa', price: 100000, quantity: 1 },
      { id: collection._id, itemType: 'Collection', name: 'Bedroom Suite', price: 500000, quantity: 1 },
    ]);

    const res = await get('/api/analytics/sales/category');
    const labels = res.body.data.map((r) => r._id);

    expect(labels).toContain('Collections');
    expect(labels).not.toContain(null);
    const collections = res.body.data.find((r) => r._id === 'Collections');
    expect(collections.totalRevenue).toBe(500000);
  });
});

describe('product performance (F-08)', () => {
  test('counts an order once even when it lists a product twice', async () => {
    const p = await makeProduct('Sofa', 'Living Room', 100000);

    await makePaidOrder([
      { id: p._id, name: 'Sofa', price: 100000, quantity: 1 },
      { id: p._id, name: 'Sofa', price: 100000, quantity: 2 },
    ]);

    const res = await get('/api/analytics/products/performance');
    const row = res.body.data.find((r) => String(r._id) === String(p._id));

    expect(row.orderCount).toBe(1);   // was 2
    expect(row.unitsSold).toBe(3);
    expect(row.totalRevenue).toBe(300000);
  });
});

describe('unaffected aggregations', () => {
  // These group by order without unwinding, so $sum: 1 was always correct.
  // Asserted so a future "fix" does not break them.
  test('sales by region counts orders correctly', async () => {
    const p = await makeProduct('Sofa', 'Living Room', 100000);
    await makePaidOrder([
      { id: p._id, name: 'Sofa', price: 100000, quantity: 1 },
      { id: p._id, name: 'Sofa', price: 100000, quantity: 1 },
    ]);

    const res = await get('/api/analytics/sales/region');
    expect(res.body.data[0].orderCount).toBe(1);
  });
});

describe('access control', () => {
  test('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/sales/category');
    expect(res.status).toBe(401);
  });
});
