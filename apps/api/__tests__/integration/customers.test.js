import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  insertProduct,
} from '../helpers/database.js';

// The customer book.
//
// The data has been in `customers` and `orders` since the first migrations;
// what was missing was any way to put the two together. So most of what is
// tested here is the joining up: who has spent what, what they bought, and
// which of it counts.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.40.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

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

/** A shopper with an account, and a session cookie for them. */
async function aShopper(name = 'Ada Obi') {
  const email = `shopper-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await api('post', '/api/auth/signup').send({
    fullName: name,
    email,
    password: 'Password123!',
    phoneNumber: '08030000000',
  });

  return { id: res.body._id, email, name, cookie: asCookie(res) };
}

/** An order placed by that shopper, taken as far as `state` says. */
async function orderFor(shopper, { quantity = 1, paid = false, refunded = false } = {}) {
  const placed = await api('post', '/api/orders/create')
    .set('Cookie', shopper.cookie)
    .send({
      shippingAddress: {
        fullName: shopper.name,
        phone: '08030000000',
        email: shopper.email,
        address: '12 Ikoyi Crescent',
        city: 'Lagos',
        state: 'Lagos',
      },
      items: [{ item: sofaId, quantity }],
    });

  const order = placed.body.order;

  if (paid || refunded) {
    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'confirmed' });
    await api('put', `/api/orders/admin/${order._id}/payment`)
      .set('Cookie', adminCookie)
      .send({ paymentStatus: 'paid' });
  }

  if (refunded) {
    await getDb().query("UPDATE orders SET status = 'refunded' WHERE id = :id", {
      replacements: { id: order._id },
    });
  }

  return order;
}

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '0';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
  sofaId = await insertProduct({ name: 'CRM Sofa', price: 10000000, cost_price: 4000000 });
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('the customer list', () => {
  it('shows everyone who has an account', async () => {
    const shopper = await aShopper('Listed Shopper');

    const res = await get('/api/customers');

    expect(res.status).toBe(200);
    const found = res.body.customers.find((c) => c._id === shopper.id);
    expect(found.username).toBe('Listed Shopper');
    expect(found.email).toBe(shopper.email);
    expect(found.orderCount).toBe(0);
    expect(found.totalSpent).toBe(0);
  });

  it('counts what they have bought and what they have spent', async () => {
    const shopper = await aShopper('Paying Shopper');
    await orderFor(shopper, { quantity: 2, paid: true });

    const res = await get(`/api/customers?search=${encodeURIComponent(shopper.email)}`);
    const [found] = res.body.customers;

    expect(found.orderCount).toBe(1);
    expect(found.totalSpent).toBe(200000);
    expect(found.lastOrderAt).toBeTruthy();
  });

  // A basket nobody paid for is not a purchase, and counting it would make
  // every lifetime-value figure a fiction.
  it('leaves unpaid and refunded orders out of what they have spent', async () => {
    const shopper = await aShopper('Mixed Shopper');
    await orderFor(shopper, { paid: true });      // ₦100,000, counts
    await orderFor(shopper);                       // unpaid, does not
    await orderFor(shopper, { refunded: true });   // refunded, does not

    const res = await get(`/api/customers?search=${encodeURIComponent(shopper.email)}`);
    const [found] = res.body.customers;

    expect(found.orderCount).toBe(3);
    expect(found.totalSpent).toBe(100000);
  });

  it('searches by name, email and phone', async () => {
    const shopper = await aShopper('Findable Person');

    for (const term of ['Findable', shopper.email, '0803000']) {
      const res = await get(`/api/customers?search=${encodeURIComponent(term)}`);
      expect(res.body.customers.some((c) => c._id === shopper.id)).toBe(true);
    }
  });

  it('sorts by what they are worth', async () => {
    const big = await aShopper('Big Spender');
    await orderFor(big, { quantity: 5, paid: true });

    const res = await get('/api/customers?sort=spent&limit=5');
    const spends = res.body.customers.map((c) => c.totalSpent);

    expect(spends).toEqual([...spends].sort((a, b) => b - a));
    expect(res.body.customers[0]._id).toBe(big.id);
  });

  it('can be narrowed to people who have actually bought something', async () => {
    await aShopper('Never Bought');
    const res = await get('/api/customers?buyersOnly=true&limit=100');

    expect(res.body.customers.every((c) => c.orderCount > 0)).toBe(true);
  });

  it('says how someone signs in', async () => {
    const shopper = await aShopper();
    const res = await get(`/api/customers?search=${encodeURIComponent(shopper.email)}`);

    expect(res.body.customers[0].signsInWith).toBe('password');
  });

  it('never publishes a password hash or a reset token', async () => {
    const res = await get('/api/customers');
    const body = JSON.stringify(res.body);

    // Named fields rather than the word: `signsInWith: "password"` is the
    // answer to how they sign in, and is meant to be there.
    for (const secret of [
      'password_hash',
      'passwordHash',
      'password_reset_token',
      'passwordResetToken',
      'supabase_user_id',
    ]) {
      expect(body).not.toContain(secret);
    }
  });
});

describe('one customer', () => {
  it('brings their orders, with what was in them', async () => {
    const shopper = await aShopper('Detailed Shopper');
    const order = await orderFor(shopper, { quantity: 3, paid: true });

    const res = await get(`/api/customers/${shopper.id}`);

    expect(res.status).toBe(200);
    expect(res.body.customer.username).toBe('Detailed Shopper');
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].orderNumber).toBe(order.orderNumber);
    expect(res.body.orders[0].items[0]).toMatchObject({ name: 'CRM Sofa', quantity: 3 });
    expect(res.body.orders[0].shippingAddress.city).toBe('Lagos');
  });

  it('brings their loyalty movements, reviews and consultations', async () => {
    const shopper = await aShopper();
    const res = await get(`/api/customers/${shopper.id}`);

    // Present and empty rather than absent: a screen that reads `.length` on an
    // undefined list breaks on the customer who has done nothing yet.
    expect(res.body.loyalty).toEqual([]);
    expect(res.body.reviews).toEqual([]);
    expect(res.body.consultations).toEqual([]);
  });

  it('404s for someone who is not there', async () => {
    expect((await get('/api/customers/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('404s rather than 500s on a malformed id', async () => {
    expect((await get('/api/customers/not-a-uuid')).status).toBe(404);
  });

  // There is no address book: an address belongs to the order it was used for,
  // because people move and an order has to keep the address it went to.
  it('derives their addresses from the orders they were used on', async () => {
    const shopper = await aShopper();
    await orderFor(shopper);
    await orderFor(shopper);

    const res = await get(`/api/customers/${shopper.id}/addresses`);

    expect(res.status).toBe(200);
    // Two orders to the same place is one address, not two.
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0]).toMatchObject({ address: '12 Ikoyi Crescent', city: 'Lagos' });
  });
});

describe('the headline figures', () => {
  it('separates people who signed up from people who bought', async () => {
    const res = await get('/api/customers/stats');

    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBeGreaterThan(0);
    expect(res.body.stats.buyers).toBeLessThanOrEqual(res.body.stats.total);
    expect(res.body.stats.revenue).toBeGreaterThan(0);
  });
});

describe('adjusting loyalty points', () => {
  it('moves the balance and records why', async () => {
    const shopper = await aShopper();

    const res = await post(`/api/customers/${shopper.id}/loyalty`, {
      points: 500,
      reason: 'Goodwill after a late delivery',
    });

    expect(res.status).toBe(200);
    expect(res.body.points).toBe(500);

    const [movement] = await rows(
      'SELECT type, points, description FROM loyalty_transactions WHERE customer_id = :id',
      { id: shopper.id }
    );
    expect(movement).toMatchObject({ type: 'adjustment', points: 500 });
    expect(movement.description).toMatch(/late delivery/);
  });

  it('takes points away as well', async () => {
    const shopper = await aShopper();
    await post(`/api/customers/${shopper.id}/loyalty`, { points: 300, reason: 'Goodwill' });

    const res = await post(`/api/customers/${shopper.id}/loyalty`, {
      points: -100,
      reason: 'Applied to an order by hand',
    });

    expect(res.body.points).toBe(200);
  });

  // A balance nobody can explain is worse than a wrong one.
  it('refuses an adjustment with no reason', async () => {
    const shopper = await aShopper();
    const res = await post(`/api/customers/${shopper.id}/loyalty`, { points: 100 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it('refuses to take the balance below zero', async () => {
    const shopper = await aShopper();
    const res = await post(`/api/customers/${shopper.id}/loyalty`, {
      points: -50,
      reason: 'Should not work',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/below zero/i);
  });

  it('refuses a zero or fractional adjustment', async () => {
    const shopper = await aShopper();

    for (const points of [0, 1.5]) {
      const res = await post(`/api/customers/${shopper.id}/loyalty`, { points, reason: 'No' });
      expect(res.status).toBe(400);
    }
  });
});

describe('who may look', () => {
  it('lets support in, because answering the phone needs it', async () => {
    const support = await signInAsOperator('support');
    const res = await api('get', '/api/customers').set('Cookie', support);

    expect(res.status).toBe(200);
  });

  it('keeps an editor out', async () => {
    const editor = await signInAsOperator('editor');
    const res = await api('get', '/api/customers').set('Cookie', editor);

    expect(res.status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    expect((await api('get', '/api/customers')).status).toBe(401);
  });

  it('does not let a signed-in shopper read the customer book', async () => {
    const shopper = await aShopper();
    const res = await api('get', '/api/customers').set('Cookie', shopper.cookie);

    expect(res.status).toBe(403);
  });
});
