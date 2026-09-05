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
} from '../helpers/database.js';

// The console's reports.
//
// Every number here is a sum over orders, so the suite builds a small, known
// set of them and asserts the arithmetic. The property that matters most is
// which orders count: a sale is paid and not cancelled, and a report that
// quietly includes an unpaid basket is worse than no report.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;
let lampId;
let setId;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '0';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  sofaId = await insertProduct({ name: 'Report Sofa', price: 10000000, category: 'Sofas' });
  lampId = await insertProduct({ name: 'Report Lamp', price: 500000, category: 'Lighting' });
  setId = await insertCollection({ name: 'Report Set', price: 20000000 });

  // Two paid orders, one unpaid, one refunded. Every expectation below is
  // derived from these four.
  await sale({ items: [{ item: sofaId, quantity: 2 }], state: 'Lagos', city: 'Ikeja' });
  await sale({ items: [{ item: lampId, quantity: 1 }], state: 'Abuja', city: 'Garki' });
  await place({ items: [{ item: setId, quantity: 1 }] }); // left unpaid
  const refunded = await place({ items: [{ item: sofaId, quantity: 1 }] });
  await getDb().query(
    `UPDATE orders SET payment_status = 'paid', status = 'refunded' WHERE id = :id`,
    { replacements: { id: refunded._id } }
  );
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.6.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

async function signInAsOperator(role = 'super_admin') {
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
}

const address = (state, city) => ({
  fullName: 'Ada Obi',
  phone: '08030000000',
  email: 'ada@example.com',
  address: '12 Ikoyi Crescent',
  city,
  state,
});

async function place({ items, state = 'Lagos', city = 'Ikeja', cookie }) {
  const res = await api('post', '/api/orders/create')
    .set('Cookie', cookie || [`anonymousId=anon-${Math.random().toString(36).slice(2)}`])
    .send({ shippingAddress: address(state, city), items });
  return res.body.order;
}

/** An order that counts as a sale: paid, and not cancelled. */
async function sale(options) {
  const order = await place(options);
  await getDb().query(
    `UPDATE orders SET payment_status = 'paid', status = 'delivered', delivered_at = now()
      WHERE id = :id`,
    { replacements: { id: order._id } }
  );
  return order;
}

const get = (path) => api('get', path).set('Cookie', adminCookie);

describe('the overview', () => {
  it('counts paid orders only in the revenue, and every order in the count', async () => {
    const res = await get('/api/analytics/overview');

    expect(res.status).toBe(200);
    // ₦200,000 sofa + ₦5,000 lamp. The unpaid and the refunded are excluded.
    expect(res.body.stats.totalRevenue).toBe(205000);
    expect(res.body.stats.totalOrders).toBe(4);
    expect(res.body.stats.averageOrderValue).toBe(102500);
  });

  it('refuses an invalid date range rather than reporting on nonsense', async () => {
    const res = await get('/api/analytics/overview?startDate=not-a-date');

    expect(res.status).toBe(400);
  });

  it('reports zero for a window with nothing in it', async () => {
    const res = await get('/api/analytics/overview?startDate=2019-01-01&endDate=2019-02-01');

    expect(res.body.stats.totalRevenue).toBe(0);
    expect(res.body.stats.totalOrders).toBe(0);
    expect(res.body.stats.averageOrderValue).toBe(0);
  });

  it('is closed to an operator without the finance permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/analytics/overview').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});

describe('sales breakdowns', () => {
  it('groups by product category', async () => {
    const res = await get('/api/analytics/sales/category');

    const sofas = res.body.data.find((row) => row._id === 'Sofas');
    const lighting = res.body.data.find((row) => row._id === 'Lighting');

    expect(sofas).toMatchObject({ totalRevenue: 200000, orderCount: 1, itemCount: 2 });
    expect(lighting).toMatchObject({ totalRevenue: 5000, orderCount: 1, itemCount: 1 });
  });

  it('groups by the state and city on the order', async () => {
    const res = await get('/api/analytics/sales/region');

    expect(res.body.data).toEqual([
      { _id: { state: 'Lagos', city: 'Ikeja' }, totalRevenue: 200000, orderCount: 1 },
      { _id: { state: 'Abuja', city: 'Garki' }, totalRevenue: 5000, orderCount: 1 },
    ]);
  });

  it('ranks products by revenue, under the name they were sold as', async () => {
    // Renaming the product does not rewrite the history of what was sold.
    await getDb().query(`UPDATE sellable_items SET name = 'Renamed Sofa' WHERE id = :id`, {
      replacements: { id: sofaId },
    });

    const res = await get('/api/analytics/products/performance');

    expect(res.body.data[0]).toMatchObject({
      _id: sofaId,
      productName: 'Report Sofa',
      totalRevenue: 200000,
      unitsSold: 2,
    });
  });

  it('honours the limit', async () => {
    const res = await get('/api/analytics/products/performance?limit=1');

    expect(res.body.data).toHaveLength(1);
  });
});

describe('customers', () => {
  it('attributes lifetime value to the account, and ignores guest orders', async () => {
    const email = `ltv-${Math.random().toString(36).slice(2)}@example.com`;
    const signedUp = await api('post', '/api/auth/signup').send({
      fullName: 'Chidi Eze',
      email,
      password: 'Password123!',
    });
    const cookie = asCookie(signedUp);

    await sale({ items: [{ item: lampId, quantity: 2 }], cookie });
    await sale({ items: [{ item: lampId, quantity: 2 }], cookie });

    const res = await get('/api/analytics/customers/lifetime-value');
    const chidi = res.body.data.find((row) => row.email === email);

    expect(chidi).toMatchObject({
      userName: 'Chidi Eze',
      totalSpent: 20000,
      orderCount: 2,
      averageOrderValue: 10000,
    });
    // Guest orders have no account to attribute a lifetime to.
    expect(res.body.data.every((row) => row._id !== null)).toBe(true);
  });

  it('counts every order at the top of the funnel and only paid ones at the bottom', async () => {
    const res = await get('/api/analytics/customers/conversion-funnel');

    const stages = Object.fromEntries(res.body.funnel.map((s) => [s.stage, s.count]));

    expect(stages['Orders Created']).toBeGreaterThan(stages['Orders Paid']);
    expect(res.body.conversionRates.confirmedToPaid).toBeGreaterThan(0);
  });
});

describe('the revenue report', () => {
  it('counts exactly the orders that are paid and not refunded', async () => {
    const res = await get('/api/finance/admin/revenue');

    // Compared against the database rather than a number written here, because
    // tests above this one add sales of their own.
    const [expected] = await getDb().query(
      `SELECT count(*)::int AS orders, COALESCE(SUM(total_amount), 0)::bigint AS total
         FROM orders
        WHERE payment_status = 'paid' AND status NOT IN ('cancelled', 'refunded')`,
      { type: QueryTypes.SELECT }
    );

    expect(res.status).toBe(200);
    expect(res.body.summary.orderCount).toBe(expected.orders);
    expect(res.body.summary.totalAmount).toBe(Number(expected.total) / 100);
  });

  it('adds the parts up to the total', async () => {
    const { summary } = (await get('/api/finance/admin/revenue')).body;

    expect(summary.subtotal - summary.discount + summary.shippingCost + summary.taxAmount).toBe(
      summary.totalAmount
    );
  });

  it('includes unpaid orders only when asked', async () => {
    const without = await get('/api/finance/admin/revenue');
    const with_ = await get('/api/finance/admin/revenue?includeUnpaid=true');

    expect(with_.body.summary.orderCount).toBeGreaterThan(without.body.summary.orderCount);
  });

  it('includes refunded orders only when asked', async () => {
    const without = await get('/api/finance/admin/revenue');
    const with_ = await get('/api/finance/admin/revenue?includeRefunded=true');

    expect(with_.body.summary.orderCount).toBeGreaterThan(without.body.summary.orderCount);
  });

  it('breaks the total down by day, and the days sum to the total', async () => {
    const res = await get('/api/finance/admin/revenue');

    const summed = res.body.daily.reduce((total, day) => total + day.totalAmount, 0);
    expect(summed).toBe(res.body.summary.totalAmount);
    expect(res.body.daily[0]._id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('exports the same figures as CSV', async () => {
    const summary = await get('/api/finance/admin/revenue');
    const csv = await get('/api/finance/admin/revenue/export');

    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('csv');
    expect(csv.headers['content-disposition']).toContain('revenue-');

    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('date,orders,subtotal,discount,tax,shipping,totalAmount');
    expect(lines).toHaveLength(summary.body.daily.length + 1);

    const exported = lines.slice(1).reduce((total, line) => total + Number(line.split(',')[6]), 0);
    expect(exported).toBe(summary.body.summary.totalAmount);
  });
});
