import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  currentDatabaseUrl,
  insertProduct,
} from '../helpers/database.js';

// Coupons and Paystack, over HTTP.
//
// Paystack itself is replaced with a stub, because the thing under test is what
// this service does with a charge — claim it once, apply it once, refuse it when
// the amount is wrong — and none of that is Paystack's behaviour to demonstrate.
// The stub answers the two calls the service makes and records what it was asked.

const SECRET = 'sk_test_checkout';

const gateway = { initializes: [], verifies: [], nextCharge: null, initializeFails: false };

jest.unstable_mockModule('../../src/services/imageStore.js', () => ({
  cloudinaryStore: {
    upload: jest.fn(async () => ({ url: 'https://cdn.test/proof.png', publicId: 'proof' })),
    destroy: jest.fn(async () => {}),
  },
  destroyQuietly: jest.fn(async () => {}),
}));

let app;

const stubPaystack = () => {
  globalThis.fetch = jest.fn(async (url, options) => {
    if (String(url).includes('/transaction/initialize')) {
      gateway.initializes.push(JSON.parse(options.body));

      if (gateway.initializeFails) {
        return { ok: false, json: async () => ({ status: false, message: 'Gateway said no' }) };
      }

      const reference = JSON.parse(options.body).reference;
      return {
        ok: true,
        json: async () => ({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.test/${reference}`,
            access_code: 'ACCESS',
            reference,
          },
        }),
      };
    }

    if (String(url).includes('/transaction/verify/')) {
      gateway.verifies.push(String(url));
      return { ok: true, json: async () => ({ status: true, data: gateway.nextCharge }) };
    }

    throw new Error(`The Paystack stub was asked for something unexpected: ${url}`);
  });
};

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '7.5';
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  stubPaystack();
  ({ default: app } = await import('../../src/app.js'));

  await getDb().query(
    `INSERT INTO accounting_periods (name, starts_on, ends_on)
     VALUES ('open-window', '2020-01-01', '2035-12-31')`
  );
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

beforeEach(() => {
  gateway.initializes.length = 0;
  gateway.verifies.length = 0;
  gateway.nextCharge = null;
  gateway.initializeFails = false;
  stubPaystack();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.2.${(callers >> 8) & 255}.${callers++ & 255}`);

const guest = () => [`anonymousId=anon-${Math.random().toString(36).slice(2)}`];
const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

const ADDRESS = {
  fullName: 'Ada Obi',
  phone: '08030000000',
  email: 'ada@example.com',
  address: '12 Ikoyi Crescent',
  city: 'Lagos',
  state: 'Lagos',
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

describe('managing coupons from the console', () => {
  let adminCookie;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
  });

  const create = (body) =>
    api('post', '/api/coupons/admin/create').set('Cookie', adminCookie).send(body);

  it('creates a percentage coupon and publishes it in the units it was given in', async () => {
    const code = `PCT${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const res = await create({
      code,
      discountType: 'percentage',
      discountValue: 12.5,
      minimumPurchase: 5000,
      maximumDiscount: 3000,
      validUntil: '2030-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code,
      discountType: 'percentage',
      discountValue: 12.5,
      minimumPurchase: 5000,
      maximumDiscount: 3000,
      usageCount: 0,
      isActive: true,
    });

    // Stored as basis points and kobo, published as a percentage and naira.
    const [row] = await rows(
      'SELECT discount_value, min_purchase, max_discount FROM coupons WHERE code = :code',
      { code }
    );
    expect(Number(row.discount_value)).toBe(1250);
    expect(Number(row.min_purchase)).toBe(500000);
    expect(Number(row.max_discount)).toBe(300000);
  });

  it('creates a fixed coupon in naira', async () => {
    const code = `FIX${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const res = await create({
      code,
      discountType: 'fixed',
      discountValue: 2500,
      validUntil: '2030-01-01',
    });

    expect(res.body.discountValue).toBe(2500);

    const [row] = await rows('SELECT discount_value FROM coupons WHERE code = :code', { code });
    expect(Number(row.discount_value)).toBe(250000);
  });

  it('upper-cases the code, and refuses a second coupon with the same one', async () => {
    const code = `DUP${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const first = await create({
      code: code.toLowerCase(),
      discountType: 'fixed',
      discountValue: 100,
      validUntil: '2030-01-01',
    });
    const second = await create({
      code,
      discountType: 'fixed',
      discountValue: 100,
      validUntil: '2030-01-01',
    });

    expect(first.body.code).toBe(code);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already exists/i);
  });

  it('refuses a percentage above 100 and a discount type that is not one', async () => {
    const tooMuch = await create({
      code: `BAD${Date.now()}`,
      discountType: 'percentage',
      discountValue: 150,
      validUntil: '2030-01-01',
    });
    const notAType = await create({
      code: `BAD2${Date.now()}`,
      discountType: 'buy-one-get-one',
      discountValue: 10,
      validUntil: '2030-01-01',
    });

    expect(tooMuch.status).toBe(400);
    expect(notAType.status).toBe(400);
  });

  it('lists, reads, edits and deletes', async () => {
    const code = `CRUD${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const created = await create({
      code,
      discountType: 'percentage',
      discountValue: 10,
      validUntil: '2030-01-01',
    });
    const id = created.body._id;

    const listed = await api('get', '/api/coupons/admin').set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.coupons.some((c) => c._id === id)).toBe(true);

    const read = await api('get', `/api/coupons/admin/${id}`).set('Cookie', adminCookie);
    expect(read.body.code).toBe(code);

    const edited = await api('put', `/api/coupons/admin/${id}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false, description: 'Retired' });
    expect(edited.body.isActive).toBe(false);
    expect(edited.body.description).toBe('Retired');
    expect(edited.body.discountValue).toBe(10); // unchanged, and not reinterpreted

    const removed = await api('delete', `/api/coupons/admin/${id}`).set('Cookie', adminCookie);
    const again = await api('delete', `/api/coupons/admin/${id}`).set('Cookie', adminCookie);
    expect(removed.status).toBe(200);
    expect(again.status).toBe(404);
  });

  it('will not let an operator without marketing rights create one', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('post', '/api/coupons/admin/create')
      .set('Cookie', editor)
      .send({ code: 'NOPE', discountType: 'fixed', discountValue: 10, validUntil: '2030-01-01' });

    expect(res.status).toBe(403);
  });
});

describe('checking a coupon before checkout', () => {
  let adminCookie;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
  });

  const create = (body) =>
    api('post', '/api/coupons/admin/create').set('Cookie', adminCookie).send(body);

  it('quotes the same discount the checkout will charge', async () => {
    const code = `Q${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await create({ code, discountType: 'percentage', discountValue: 10, validUntil: '2030-01-01' });

    const res = await api('post', '/api/coupons/validate').send({ code, subtotal: 100000 });

    expect(res.status).toBe(200);
    expect(res.body.discount).toBe(10000);
    expect(res.body.finalTotal).toBe(90000);
  });

  it('says why a coupon does not apply, rather than just "invalid"', async () => {
    const expired = `E${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const small = `M${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await create({
      code: expired,
      discountType: 'fixed',
      discountValue: 100,
      validFrom: '2019-01-01',
      validUntil: '2020-01-01',
    });
    await create({
      code: small,
      discountType: 'fixed',
      discountValue: 100,
      minimumPurchase: 50000,
      validUntil: '2030-01-01',
    });

    const gone = await api('post', '/api/coupons/validate').send({ code: expired, subtotal: 100000 });
    const belowMinimum = await api('post', '/api/coupons/validate').send({
      code: small,
      subtotal: 100,
    });
    const unknown = await api('post', '/api/coupons/validate').send({
      code: 'NOSUCH',
      subtotal: 100,
    });

    expect(gone.body.message).toMatch(/expired/i);
    expect(belowMinimum.body.message).toMatch(/at least/i);
    expect(unknown.status).toBe(404);
  });

  it('does not spend a use just by being checked', async () => {
    const code = `NOSPEND${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    await create({
      code,
      discountType: 'fixed',
      discountValue: 100,
      usageLimit: 1,
      validUntil: '2030-01-01',
    });

    await api('post', '/api/coupons/validate').send({ code, subtotal: 100000 });
    await api('post', '/api/coupons/validate').send({ code, subtotal: 100000 });

    const [row] = await rows('SELECT times_used FROM coupons WHERE code = :code', { code });
    expect(row.times_used).toBe(0);
  });
});

describe('paying with Paystack', () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'Paid Sofa', price: 10000000, sku: 'PAY-1' });
  });

  const placeOrder = async (cookie) => {
    const res = await api('post', '/api/orders/create')
      .set('Cookie', cookie)
      .send({ shippingAddress: ADDRESS, items: [{ item: itemId, quantity: 1 }] });
    return res.body.order;
  };

  const initialize = (cookie, orderId) =>
    api('post', '/api/payments/paystack/initialize').set('Cookie', cookie).send({ orderId });

  const chargeFor = (order, reference, overrides = {}) => ({
    reference,
    status: 'success',
    // Kobo, exactly as the order holds it. 107,500 = 100,000 + 7.5% VAT.
    amount: Math.round(order.totalAmount * 100),
    currency: 'NGN',
    ...overrides,
  });

  // The signature covers the exact bytes sent, so the body is built as a string
  // and sent as one — handing supertest a Buffer with a JSON content type makes
  // it serialise the Buffer itself, which signs one thing and sends another.
  const webhook = (event) => {
    const body = JSON.stringify(event);
    const signature = crypto.createHmac('sha512', SECRET).update(body).digest('hex');
    return request(app)
      .post('/api/payments/paystack/webhook')
      .set('X-Forwarded-For', `10.3.${callers++ & 255}.1`)
      .set('x-paystack-signature', signature)
      .set('Content-Type', 'application/json')
      .send(body);
  };

  it('asks Paystack for the order total in kobo, and records the attempt', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);

    const res = await initialize(cookie, order._id);

    expect(res.status).toBe(200);
    expect(res.body.authorizationUrl).toContain('checkout.paystack.test');
    expect(gateway.initializes[0].amount).toBe(10750000);
    expect(gateway.initializes[0].currency).toBe('NGN');

    const [tx] = await rows(
      'SELECT amount, status, payment_method FROM payment_transactions WHERE order_id = :id',
      { id: order._id }
    );
    expect(Number(tx.amount)).toBe(10750000);
    expect(tx.status).toBe('pending');
    expect(tx.payment_method).toBe('paystack');
  });

  it('reuses the attempt already in flight rather than issuing a second reference', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);

    const first = await initialize(cookie, order._id);
    const second = await initialize(cookie, order._id);

    expect(second.body.reference).toBe(first.body.reference);
    expect(gateway.initializes).toHaveLength(1);
  });

  it('will not start a payment for somebody else’s order', async () => {
    const order = await placeOrder(guest());

    const res = await initialize(guest(), order._id);

    expect(res.status).toBe(403);
  });

  it('reports the gateway refusing to start a checkout', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    gateway.initializeFails = true;

    const res = await initialize(cookie, order._id);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Gateway said no');
  });

  it('confirms the order, posts the sale and the payment, and takes the stock', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference);

    const res = await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const [updated] = await rows(
      'SELECT status, payment_status, payment_method FROM orders WHERE id = :id',
      { id: order._id }
    );
    expect(updated).toEqual({
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'paystack',
    });

    const entries = await rows(
      `SELECT source FROM journal_entries WHERE source_id IN (:ids) ORDER BY source`,
      { ids: [order._id, body.transactionId] }
    );
    expect(entries.map((e) => e.source).sort()).toEqual(['payment', 'sales_order']);

    const movements = await rows(
      'SELECT quantity, reason FROM stock_movements WHERE order_id = :id',
      { id: order._id }
    );
    expect(movements).toEqual([{ quantity: -1, reason: 'sale' }]);
  });

  it('changes nothing the second time the same charge arrives', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference);

    // The redirect first, then the webhook — the ordinary sequence.
    await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);
    const replay = await webhook({ event: 'charge.success', data: gateway.nextCharge });

    expect(replay.status).toBe(200);

    const entries = await rows(
      `SELECT count(*)::int AS total FROM journal_entries WHERE source_id = :id`,
      { id: order._id }
    );
    const movements = await rows(
      'SELECT count(*)::int AS total FROM stock_movements WHERE order_id = :id',
      { id: order._id }
    );
    expect(entries[0].total).toBe(1);
    expect(movements[0].total).toBe(1);
  });

  it('applies a charge that arrives only by webhook', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);

    const res = await webhook({
      event: 'charge.success',
      data: chargeFor(order, body.reference),
    });

    expect(res.status).toBe(200);

    const [updated] = await rows('SELECT payment_status FROM orders WHERE id = :id', {
      id: order._id,
    });
    expect(updated.payment_status).toBe('paid');
  });

  it('refuses a charge for the wrong amount, and leaves the order unpaid', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference, { amount: 100 });

    const res = await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    expect(res.status).toBe(409);

    const [updated] = await rows('SELECT payment_status FROM orders WHERE id = :id', {
      id: order._id,
    });
    const [tx] = await rows(
      'SELECT status, verification_notes FROM payment_transactions WHERE gateway_reference = :ref',
      { ref: body.reference }
    );
    expect(updated.payment_status).toBe('pending');
    expect(tx.status).toBe('failed');
    expect(tx.verification_notes).toMatch(/mismatch/i);
  });

  it('refuses a charge in the wrong currency', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference, { currency: 'USD' });

    const res = await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    expect(res.status).toBe(409);
  });

  it('records a failed charge without touching the order', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference, { status: 'abandoned' });

    const res = await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    expect(res.body.status).toBe('failed');

    const [tx] = await rows(
      'SELECT status FROM payment_transactions WHERE gateway_reference = :ref',
      { ref: body.reference }
    );
    expect(tx.status).toBe('failed');
  });

  it('404s for a reference it never issued', async () => {
    gateway.nextCharge = { reference: 'EM-UNKNOWN', status: 'success', amount: 1, currency: 'NGN' };

    const res = await api('get', '/api/payments/paystack/verify?reference=EM-UNKNOWN');

    expect(res.status).toBe(404);
  });

  it('will not start a payment for an order that is already paid', async () => {
    const cookie = guest();
    const order = await placeOrder(cookie);
    const { body } = await initialize(cookie, order._id);
    gateway.nextCharge = chargeFor(order, body.reference);
    await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    const res = await initialize(cookie, order._id);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already paid/i);
  });

  it('empties the basket once the order is paid', async () => {
    const cookie = guest();
    await api('put', '/api/cart/add').set('Cookie', cookie).send({ itemId, quantity: 1 });
    const { registerCustomer } = await import('../../src/services/identity.js');
    const customer = await registerCustomer({
      fullName: 'Ada Obi',
      email: `paid-${Math.random().toString(36).slice(2)}@example.com`,
      password: 'Password123!',
    });

    const signedIn = await api('post', '/api/auth/login')
      .set('Cookie', cookie)
      .send({ email: customer.email, password: 'Password123!' });
    const session = asCookie(signedIn);

    const order = await placeOrder(session);
    const { body } = await initialize(session, order._id);
    gateway.nextCharge = chargeFor(order, body.reference);
    await api('get', `/api/payments/paystack/verify?reference=${body.reference}`);

    const cart = await api('get', '/api/cart').set('Cookie', session);
    expect(cart.body.cart).toEqual([]);
  });
});

describe('proof of a bank transfer', () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertProduct({ name: 'Transfer Sofa', price: 5000000 });
  });

  it('is attached to the order without marking it paid', async () => {
    const cookie = guest();
    const placed = await api('post', '/api/orders/create')
      .set('Cookie', cookie)
      .send({ shippingAddress: ADDRESS, items: [{ item: itemId, quantity: 1 }] });
    const order = placed.body.order;

    const res = await api('post', '/api/payments/bank-transfer/proof')
      .set('Cookie', cookie)
      .send({
        orderId: order._id,
        proofData: 'data:image/png;base64,AAAA',
        bankName: 'GTBank',
        transferReference: 'TRF-1',
        transferDate: '2026-09-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.proofUrl).toBe('https://cdn.test/proof.png');

    const [tx] = await rows(
      `SELECT status, payment_method, bank_name, bank_transfer_proof
         FROM payment_transactions WHERE order_id = :id`,
      { id: order._id }
    );
    const [updated] = await rows(
      'SELECT payment_status, payment_method FROM orders WHERE id = :id',
      { id: order._id }
    );

    expect(tx.status).toBe('pending');
    expect(tx.bank_name).toBe('GTBank');
    // Somebody has to look at the slip; uploading it does not pay the order.
    expect(updated.payment_status).toBe('pending');
    expect(updated.payment_method).toBe('bank_transfer');
  });

  it('refuses to attach proof to an order the requester does not own', async () => {
    const placed = await api('post', '/api/orders/create')
      .set('Cookie', guest())
      .send({ shippingAddress: ADDRESS, items: [{ item: itemId, quantity: 1 }] });

    const res = await api('post', '/api/payments/bank-transfer/proof')
      .set('Cookie', guest())
      .send({ orderId: placed.body.order._id, proofData: 'data:image/png;base64,AAAA' });

    expect(res.status).toBe(403);
  });
});
