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

// Orders, over HTTP.
//
// The property this suite exists to protect is that the money on an order comes
// from the database and not from the browser. Several tests therefore send a
// deliberately wrong figure and assert the server ignored it — under Mongo the
// total was whatever the request said it was.

const sent = [];

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async (message) => {
    sent.push(message);
    return { id: 'test-message' };
  }),
}));

let app;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '7.5';
  ({ default: app } = await import('../../src/app.js'));

});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

beforeEach(() => {
  sent.length = 0;
});

/** Each request from its own address: the rate limiters are real. */
let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.1.${(callers >> 8) & 255}.${callers++ & 255}`);

const someEmail = () => `shopper-${Math.random().toString(36).slice(2)}@example.com`;
const guest = () => [`anonymousId=anon-${Math.random().toString(36).slice(2)}`];
const jwtCookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt='));
const asCookie = (res) => [jwtCookie(res).split(';')[0]];

const ADDRESS = {
  fullName: 'Ada Obi',
  phone: '08030000000',
  email: 'ada@example.com',
  address: '12 Ikoyi Crescent',
  city: 'Lagos',
  state: 'Lagos',
};

const signUp = async (overrides = {}) => {
  const email = overrides.email ?? someEmail();
  const res = await api('post', '/api/auth/signup').send({
    fullName: 'Ada Obi',
    email,
    password: 'Password123!',
    ...overrides,
  });
  return { cookie: asCookie(res), customerId: res.body.id, email };
};

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

const place = (cookie, body) =>
  api('post', '/api/orders/create')
    .set('Cookie', cookie)
    .send({ shippingAddress: ADDRESS, ...body });

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

describe('placing an order', () => {
  let sofaId;

  beforeAll(async () => {
    sofaId = await insertProduct({ name: 'Milano Sofa', price: 45000000 }); // ₦450,000
  });

  it('prices the order from the catalog, not from the request', async () => {
    const res = await place(guest(), {
      items: [{ item: sofaId, itemType: 'Product', quantity: 2 }],
      // What a tampered client would send. Every one of these is ignored.
      subtotal: 1,
      totalAmount: 1,
      taxAmount: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body.order.subtotal).toBe(900000);
    expect(res.body.order.taxAmount).toBe(67500); // 7.5% of ₦900,000
    expect(res.body.order.totalAmount).toBe(967500);
    expect(res.body.order.items).toEqual([
      expect.objectContaining({ name: 'Milano Sofa', price: 450000, quantity: 2, subtotal: 900000 }),
    ]);
  });

  it('charges the promotional price when there is one', async () => {
    const promoId = await insertProduct({
      name: 'Promo Chair',
      price: 10000000,
      is_promo: true,
      discounted_price: 7500000,
    });

    const res = await place(guest(), { items: [{ item: promoId, quantity: 1 }] });

    expect(res.body.order.items[0].price).toBe(75000);
    expect(res.body.order.subtotal).toBe(75000);
  });

  it('adds shipping to the taxable amount and to the total', async () => {
    const res = await place(guest(), {
      items: [{ item: sofaId, quantity: 1 }],
      shippingCost: 10000,
    });

    expect(res.body.order.shippingCost).toBe(10000);
    expect(res.body.order.taxAmount).toBe(34500); // 7.5% of 450,000 + 10,000
    expect(res.body.order.totalAmount).toBe(494500);
  });

  it('sells a collection as readily as a product', async () => {
    const setId = await insertCollection({ name: 'Milano Set', price: 120000000 });

    const res = await place(guest(), { items: [{ item: setId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.order.items[0].itemType).toBe('Collection');
  });

  it('gives the order a number and records its first status', async () => {
    const res = await place(guest(), { items: [{ item: sofaId, quantity: 1 }] });

    expect(res.body.order.orderNumber).toMatch(/^ORD-\d{4}-\d{5}$/);
    expect(res.body.order.status).toBe('pending');

    const events = await rows(
      'SELECT status FROM order_status_events WHERE order_id = :id',
      { id: res.body.order._id }
    );
    expect(events).toEqual([{ status: 'pending' }]);
  });

  it('refuses an order with no items, and one naming an item that does not exist', async () => {
    expect((await place(guest(), { items: [] })).status).toBe(400);

    const missing = await place(guest(), {
      items: [{ item: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
    });
    expect(missing.status).toBe(404);
  });

  it('refuses an address that is missing a field the courier needs', async () => {
    const res = await api('post', '/api/orders/create')
      .set('Cookie', guest())
      .send({
        items: [{ item: sofaId, quantity: 1 }],
        shippingAddress: { ...ADDRESS, city: undefined },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/city/);
  });

  it('refuses a fractional quantity rather than rounding it', async () => {
    const res = await place(guest(), { items: [{ item: sofaId, quantity: 1.5 }] });

    expect(res.status).toBe(400);
  });

  it('sends the shopper a confirmation, and does not fail the order if it cannot', async () => {
    const res = await place(guest(), { items: [{ item: sofaId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain(res.body.order.orderNumber);
  });

  it('answers a double-submitted checkout with the first order, not a second one', async () => {
    const key = `idem-${Math.random().toString(36).slice(2)}`;
    const cookie = guest();
    const body = { items: [{ item: sofaId, quantity: 1 }] };

    const first = await api('post', '/api/orders/create')
      .set('Cookie', cookie)
      .set('Idempotency-Key', key)
      .send({ shippingAddress: ADDRESS, ...body });
    const second = await api('post', '/api/orders/create')
      .set('Cookie', cookie)
      .set('Idempotency-Key', key)
      .send({ shippingAddress: ADDRESS, ...body });

    expect(second.body.order._id).toBe(first.body.order._id);

    const counted = await rows(
      'SELECT count(*)::int AS total FROM orders WHERE idempotency_key = :key',
      { key }
    );
    expect(counted[0].total).toBe(1);

    // And the shopper is told once, not twice.
    expect(sent).toHaveLength(1);
  });
});

describe('coupons at checkout', () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'Coupon Sofa', price: 10000000 }); // ₦100,000
  });

  const makeCoupon = async (overrides = {}) => {
    const code = overrides.code ?? `SAVE${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await getDb().query(
      `INSERT INTO coupons (code, discount_type, discount_value, max_discount, min_purchase,
                            usage_limit, expires_at, is_active)
       VALUES (:code, :type::discount_type, :value, :maxDiscount, :minPurchase,
               :usageLimit, :expiresAt, :isActive)`,
      {
        replacements: {
          code,
          type: overrides.type ?? 'percentage',
          value: overrides.value ?? 1000, // 10.00%
          maxDiscount: overrides.maxDiscount ?? null,
          minPurchase: overrides.minPurchase ?? 0,
          usageLimit: overrides.usageLimit ?? null,
          expiresAt: overrides.expiresAt ?? null,
          isActive: overrides.isActive ?? true,
        },
      }
    );
    return code;
  };

  it('applies a percentage discount and counts the use', async () => {
    const code = await makeCoupon({ value: 1000 });

    const res = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });

    expect(res.body.order.discount).toBe(10000);
    expect(res.body.order.couponCode).toBe(code);
    expect(res.body.order.totalAmount).toBe(96750); // 90,000 + 7.5%

    const [coupon] = await rows('SELECT times_used FROM coupons WHERE code = :code', { code });
    expect(coupon.times_used).toBe(1);
  });

  it('caps a percentage discount at max_discount', async () => {
    const code = await makeCoupon({ value: 5000, maxDiscount: 500000 }); // 50%, capped at ₦5,000

    const res = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });

    expect(res.body.order.discount).toBe(5000);
  });

  it('takes a fixed discount in naira', async () => {
    const code = await makeCoupon({ type: 'fixed', value: 250000 }); // ₦2,500

    const res = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });

    expect(res.body.order.discount).toBe(2500);
  });

  it('matches a code the shopper typed in lower case', async () => {
    const code = await makeCoupon();

    const res = await place(guest(), {
      items: [{ item: itemId, quantity: 1 }],
      couponCode: code.toLowerCase(),
    });

    expect(res.body.order.discount).toBeGreaterThan(0);
  });

  it('charges full price for a code that is expired, inactive, or below its minimum', async () => {
    const expired = await makeCoupon({ expiresAt: '2020-01-01' });
    const inactive = await makeCoupon({ isActive: false });
    const tooSmall = await makeCoupon({ minPurchase: 99999999 });

    for (const code of [expired, inactive, tooSmall, 'NOSUCHCODE']) {
      const res = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });

      expect(res.status).toBe(201);
      expect(res.body.order.discount).toBe(0);
      expect(res.body.order.couponCode).toBeNull();
    }
  });

  it('will not spend a single-use code twice', async () => {
    const code = await makeCoupon({ usageLimit: 1 });

    const first = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });
    const second = await place(guest(), { items: [{ item: itemId, quantity: 1 }], couponCode: code });

    expect(first.body.order.discount).toBeGreaterThan(0);
    expect(second.body.order.discount).toBe(0);

    const [coupon] = await rows('SELECT times_used FROM coupons WHERE code = :code', { code });
    expect(coupon.times_used).toBe(1);
  });

  it('does not spend a code on an order that fails after it was claimed', async () => {
    const code = await makeCoupon();

    const res = await place(guest(), {
      items: [
        { item: itemId, quantity: 1 },
        { item: '11111111-1111-4111-8111-111111111111', quantity: 1 },
      ],
      couponCode: code,
    });

    expect(res.status).toBe(404);

    // The claim and the order are one transaction; a rolled-back order takes
    // the coupon use with it.
    const [coupon] = await rows('SELECT times_used FROM coupons WHERE code = :code', { code });
    expect(coupon.times_used).toBe(0);
  });
});

describe('a shopper reading their own orders', () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'History Sofa', price: 5000000 });
  });

  it('lists a guest’s orders against their cookie', async () => {
    const cookie = guest();
    await place(cookie, { items: [{ item: itemId, quantity: 1 }] });
    await place(cookie, { items: [{ item: itemId, quantity: 2 }] });

    const res = await api('get', '/api/orders/my-orders').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('lists a signed-in shopper’s orders', async () => {
    const { cookie } = await signUp();
    await place(cookie, { items: [{ item: itemId, quantity: 1 }] });

    const res = await api('get', '/api/orders/my-orders').set('Cookie', cookie);

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].isGuestOrder).toBe(false);
  });

  it('answers an empty list for someone with no session at all', async () => {
    const res = await api('get', '/api/orders/my-orders');

    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it('will not show one shopper another shopper’s order', async () => {
    const mine = await place(guest(), { items: [{ item: itemId, quantity: 1 }] });

    const res = await api('get', `/api/orders/${mine.body.order._id}`).set('Cookie', guest());

    expect(res.status).toBe(403);
  });

  it('404s for an order id that is not an id at all', async () => {
    const res = await api('get', '/api/orders/not-a-uuid').set('Cookie', guest());

    expect(res.status).toBe(404);
  });
});

describe('tracking an order without signing in', () => {
  let itemId;
  let orderNumber;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'Tracked Sofa', price: 3000000 });
    const res = await place(guest(), { items: [{ item: itemId, quantity: 1 }] });
    orderNumber = res.body.order.orderNumber;
  });

  it('needs the number and the email together', async () => {
    const noEmail = await api('get', `/api/orders/track/${orderNumber}`);
    const wrongEmail = await api('get', `/api/orders/track/${orderNumber}?email=someone@else.com`);

    expect(noEmail.status).toBe(400);
    expect(wrongEmail.status).toBe(404);
  });

  it('finds the order when they match, whatever the case', async () => {
    const res = await api('get', `/api/orders/track/${orderNumber}?email=ADA@EXAMPLE.COM`);

    expect(res.status).toBe(200);
    expect(res.body.order.orderNumber).toBe(orderNumber);
  });
});

describe('the console managing orders', () => {
  let adminCookie;
  let itemId;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
    itemId = await insertProduct({ name: 'Console Sofa', price: 20000000, sku: 'CONSOLE-1' });
  });

  const anOrder = async (cookie = guest()) => {
    const res = await place(cookie, { items: [{ item: itemId, quantity: 2 }] });
    return res.body.order;
  };

  it('refuses an operator without the orders permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/orders/admin/all').set('Cookie', editor);

    expect(res.status).toBe(403);
  });

  it('lists orders, filtered by status and searched by buyer', async () => {
    const order = await anOrder();

    const byStatus = await api('get', '/api/orders/admin/all?status=pending').set('Cookie', adminCookie);
    const bySearch = await api('get', `/api/orders/admin/all?search=${order.orderNumber}`).set(
      'Cookie',
      adminCookie
    );

    expect(byStatus.body.orders.length).toBeGreaterThan(0);
    expect(bySearch.body.orders).toHaveLength(1);
    expect(bySearch.body.orders[0]._id).toBe(order._id);
  });

  it('records a status change, who made it, and the note', async () => {
    const order = await anOrder();

    const res = await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'processing', note: 'Assembling', trackingNumber: 'TRK-1' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('processing');
    expect(res.body.order.trackingNumber).toBe('TRK-1');

    const events = await rows(
      `SELECT status, note, changed_by FROM order_status_events
        WHERE order_id = :id ORDER BY created_at`,
      { id: order._id }
    );
    expect(events.map((e) => e.status)).toEqual(['pending', 'processing']);
    expect(events[1].note).toBe('Assembling');
    expect(events[1].changed_by).not.toBeNull();
  });

  it('refuses a status that is not one of the seven', async () => {
    const order = await anOrder();

    const res = await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'teleported' });

    expect(res.status).toBe(400);
  });

  it('posts the sale to the ledger when the order is confirmed', async () => {
    const order = await anOrder();

    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'confirmed' });

    const lines = await rows(
      `SELECT a.code, l.debit::bigint AS debit, l.credit::bigint AS credit
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.source = 'sales_order' AND e.source_id = :id
        ORDER BY a.code`,
      { id: order._id }
    );

    expect(lines.length).toBeGreaterThan(0);
    const debits = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const credits = lines.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(debits).toBe(credits);
    expect(lines.map((l) => l.code)).toContain('1200'); // accounts receivable
  });

  it('does not post the same order twice when it is confirmed again', async () => {
    const order = await anOrder();
    const confirm = () =>
      api('put', `/api/orders/admin/${order._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'confirmed' });

    await confirm();
    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'processing' });
    await confirm();

    const entries = await rows(
      `SELECT count(*)::int AS total FROM journal_entries
        WHERE source = 'sales_order' AND source_id = :id`,
      { id: order._id }
    );
    expect(entries[0].total).toBe(1);
  });

  it('sets delivered_at itself, which the schema requires', async () => {
    const order = await anOrder();

    const res = await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(res.body.order.deliveredAt).not.toBeNull();
  });

  it('credits loyalty points on delivery, once', async () => {
    const { cookie, customerId } = await signUp();
    const order = await anOrder(cookie); // ₦400,000 + tax

    const deliver = () =>
      api('put', `/api/orders/admin/${order._id}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'delivered' });

    await deliver();
    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'shipped' });
    await deliver();

    const [customer] = await rows('SELECT loyalty_points FROM customers WHERE id = :id', {
      id: customerId,
    });
    expect(customer.loyalty_points).toBe(430); // floor(430,000 / 1000)
  });

  it('takes the goods out of stock when the order is paid, once', async () => {
    const order = await anOrder();

    const pay = () =>
      api('put', `/api/orders/admin/${order._id}/payment`)
        .set('Cookie', adminCookie)
        .send({ paymentStatus: 'paid' });

    await pay();
    await api('put', `/api/orders/admin/${order._id}/payment`)
      .set('Cookie', adminCookie)
      .send({ paymentStatus: 'pending' });
    await pay();

    const movements = await rows(
      `SELECT quantity, reason FROM stock_movements WHERE order_id = :id`,
      { id: order._id }
    );
    expect(movements).toEqual([{ quantity: -2, reason: 'sale' }]);
  });

  it('deletes an order, and 404s for one that is already gone', async () => {
    const order = await anOrder();

    const first = await api('delete', `/api/orders/admin/${order._id}`).set('Cookie', adminCookie);
    const second = await api('delete', `/api/orders/admin/${order._id}`).set('Cookie', adminCookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });
});

describe('order documents', () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'Invoice Sofa', price: 1000000 });
  });

  it('will not print an order to a shopper it does not belong to', async () => {
    // The Mongo version looked the order up by id and printed it, with no
    // ownership check at all on the customer-facing route.
    const mine = await place(guest(), { items: [{ item: itemId, quantity: 1 }] });

    const res = await api('get', `/api/orders/${mine.body.order._id}/invoice`).set(
      'Cookie',
      guest()
    );

    expect(res.status).toBe(403);
  });

  it('prints an invoice for the shopper who placed it', async () => {
    const cookie = guest();
    const mine = await place(cookie, { items: [{ item: itemId, quantity: 1 }] });

    const res = await api('get', `/api/orders/${mine.body.order._id}/invoice`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('pdf');
  });

  it('offers a receipt only once the order is paid', async () => {
    const adminCookie = await signInAsOperator();
    const cookie = guest();
    const mine = await place(cookie, { items: [{ item: itemId, quantity: 1 }] });

    const unpaid = await api('get', `/api/orders/${mine.body.order._id}/receipt`).set('Cookie', cookie);
    expect(unpaid.status).toBe(400);

    await api('put', `/api/orders/admin/${mine.body.order._id}/payment`)
      .set('Cookie', adminCookie)
      .send({ paymentStatus: 'paid' });

    const paid = await api('get', `/api/orders/${mine.body.order._id}/receipt`).set('Cookie', cookie);
    expect(paid.status).toBe(200);
  });
});
