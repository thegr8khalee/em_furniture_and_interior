import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb, insertProduct } from '../helpers/database.js';

// Refunds.
//
// Both status enums have carried `refunded` since the first commerce migration
// and nothing behind it did anything — so most of these tests are about the
// three things a refund is supposed to move and never did: the revenue, the
// cash, and the stock.
//
// The figures throughout: a sofa costing ₦40,000 sold for ₦100,000, VAT at 10%,
// so an order of one comes to ₦110,000.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.60.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const suffix = Math.random().toString(36).slice(2);
  await registerStaff({
    username: `ops-${suffix}`,
    email: `ops-${suffix}@example.com`,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({
    email: `ops-${suffix}@example.com`,
    password: 'Password123!',
  });
  return asCookie(res);
}

/** The balance of one account, in naira. */
const balanceOf = async (code) => {
  const res = await get('/api/books/trial-balance');
  return res.body.accounts.find((a) => a.code === code)?.balance ?? 0;
};

/** An order, taken all the way to paid, which is what makes it refundable. */
async function aPaidOrder(quantity = 1) {
  const placed = await api('post', '/api/orders/create')
    .set('Cookie', [`anonymousId=anon-${Math.random().toString(36).slice(2)}`])
    .send({
      shippingAddress: {
        fullName: 'Ada Obi',
        phone: '08030000000',
        email: 'ada@example.com',
        address: '12 Ikoyi Crescent',
        city: 'Lagos',
        state: 'Lagos',
      },
      items: [{ item: sofaId, quantity }],
    });

  const order = placed.body.order;

  await api('put', `/api/orders/admin/${order._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'confirmed' });
  await api('put', `/api/orders/admin/${order._id}/payment`)
    .set('Cookie', adminCookie)
    .send({ paymentStatus: 'paid' });

  return order;
}

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '10';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
  sofaId = await insertProduct({
    name: 'Refund Sofa',
    price: 10000000, // ₦100,000
    cost_price: 4000000, // ₦40,000
    sku: 'REFUND-1',
  });
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('a full refund', () => {
  it('takes the revenue and the VAT back out and the cash with them', async () => {
    const sales = await balanceOf('4100');
    const vat = await balanceOf('2200');
    const bank = await balanceOf('1120');

    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, {
      reason: 'Arrived damaged',
    });

    expect(res.status).toBe(201);
    expect(res.body.refund.amount).toBe(110000);

    // Sold then refunded nets to nothing, on every account it touched.
    expect(await balanceOf('4100')).toBe(sales);
    expect(await balanceOf('2200')).toBe(vat);
    expect(await balanceOf('1120')).toBe(bank);
  });

  it('marks the order and its receipt refunded', async () => {
    const order = await aPaidOrder();
    await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Changed their mind' });

    const [row] = await rows(
      'SELECT status::text, payment_status::text FROM orders WHERE id = :id',
      { id: order._id }
    );
    expect(row).toMatchObject({ status: 'refunded', payment_status: 'refunded' });

    const [receipt] = await rows(
      `SELECT status::text, amount, refunded_amount FROM payment_transactions
        WHERE order_id = :id`,
      { id: order._id }
    );
    expect(receipt.status).toBe('refunded');
    expect(Number(receipt.refunded_amount)).toBe(Number(receipt.amount));
  });

  it('writes one journal entry, sourced to the refund', async () => {
    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Faulty' });

    const entries = await rows(
      `SELECT id FROM journal_entries WHERE source = 'refund' AND source_id = :id`,
      { id: res.body.refund._id }
    );

    expect(entries).toHaveLength(1);
  });

  it('leaves the books in balance', async () => {
    const order = await aPaidOrder(2);
    await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Wrong colour' });

    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });
});

describe('the goods coming back', () => {
  it('returns them to stock and reverses the cost of sale', async () => {
    const inventory = await balanceOf('1300');
    const cogs = await balanceOf('5100');

    const order = await aPaidOrder(3);

    // Selling took three out and booked ₦120,000 of cost.
    expect(await balanceOf('5100')).toBe(cogs + 120000);

    await post(`/api/orders/admin/${order._id}/refunds`, {
      reason: 'Returned unopened',
      restock: true,
    });

    // Coming back puts the value and the count back.
    expect(await balanceOf('1300')).toBe(inventory);
    expect(await balanceOf('5100')).toBe(cogs);

    const [movement] = await rows(
      `SELECT quantity, reason::text FROM stock_movements
        WHERE order_id = :id AND reason = 'return'`,
      { id: order._id }
    );
    expect(movement).toMatchObject({ quantity: 3, reason: 'return' });
  });

  it('leaves stock alone when the goods did not come back', async () => {
    const order = await aPaidOrder();
    await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Kept it, we paid out' });

    const returns = await rows(
      `SELECT id FROM stock_movements WHERE order_id = :id AND reason = 'return'`,
      { id: order._id }
    );
    expect(returns).toHaveLength(0);
  });
});

describe('a partial refund', () => {
  it('gives back part of the money and leaves the order standing', async () => {
    const order = await aPaidOrder();
    const bank = await balanceOf('1120');

    const res = await post(`/api/orders/admin/${order._id}/refunds`, {
      amount: 20000,
      reason: 'Goodwill for a late delivery',
    });

    expect(res.status).toBe(201);
    expect(await balanceOf('1120')).toBe(bank - 20000);

    // Still a paid order — part of it was given back, it was not undone.
    const [row] = await rows(
      'SELECT status::text, payment_status::text FROM orders WHERE id = :id',
      { id: order._id }
    );
    expect(row.payment_status).toBe('paid');
    expect(row.status).not.toBe('refunded');
  });

  // Three thirds of an odd number of kobo do not add back up, so the shares are
  // allocated rather than multiplied.
  it('splits an awkward amount across revenue and VAT to the kobo', async () => {
    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, {
      amount: 33333.33,
      reason: 'A third, awkwardly',
    });

    const lines = await rows(
      `SELECT SUM(l.debit)::bigint AS debit, SUM(l.credit)::bigint AS credit
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
        WHERE e.source = 'refund' AND e.source_id = :id`,
      { id: res.body.refund._id }
    );

    expect(Number(lines[0].debit)).toBe(Number(lines[0].credit));
    expect(Number(lines[0].debit)).toBe(3333333);
  });

  it('adds up across several refunds and then stops', async () => {
    const order = await aPaidOrder();

    await post(`/api/orders/admin/${order._id}/refunds`, { amount: 60000, reason: 'First' });
    await post(`/api/orders/admin/${order._id}/refunds`, { amount: 50000, reason: 'Second' });

    const listed = await get(`/api/orders/admin/${order._id}/refunds`);
    expect(listed.body.refunds).toHaveLength(2);
    expect(listed.body.refunded).toBe(110000);
    expect(listed.body.refundable).toBe(0);

    // The whole ₦110,000 is back, so the order is refunded after all.
    const [row] = await rows('SELECT payment_status::text FROM orders WHERE id = :id', {
      id: order._id,
    });
    expect(row.payment_status).toBe('refunded');
  });

  it('refuses to give back more than is left', async () => {
    const order = await aPaidOrder();
    await post(`/api/orders/admin/${order._id}/refunds`, { amount: 100000, reason: 'Most of it' });

    const res = await post(`/api/orders/admin/${order._id}/refunds`, {
      amount: 20000,
      reason: 'More than remains',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/more than is left/i);
  });

  // Picking which lines came back out of a partial refund is a guess, and a
  // guess about stock is how a count stops being explainable.
  it('refuses to restock on a partial refund', async () => {
    const order = await aPaidOrder(2);
    const res = await post(`/api/orders/admin/${order._id}/refunds`, {
      amount: 50000,
      reason: 'Half',
      restock: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/full refund/i);
  });
});

describe('what cannot be refunded', () => {
  it('refuses an order nobody paid for', async () => {
    const placed = await api('post', '/api/orders/create')
      .set('Cookie', [`anonymousId=anon-${Math.random().toString(36).slice(2)}`])
      .send({
        shippingAddress: {
          fullName: 'Ada Obi',
          phone: '08030000000',
          email: 'ada@example.com',
          address: '12 Ikoyi Crescent',
          city: 'Lagos',
          state: 'Lagos',
        },
        items: [{ item: sofaId, quantity: 1 }],
      });

    const res = await post(`/api/orders/admin/${placed.body.order._id}/refunds`, {
      reason: 'Never paid',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/never paid/i);
  });

  // It is the first thing anyone asks about a refund later.
  it('refuses one with no reason', async () => {
    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, {});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it('refuses a zero or negative amount', async () => {
    const order = await aPaidOrder();

    for (const amount of [0, -100]) {
      const res = await post(`/api/orders/admin/${order._id}/refunds`, { amount, reason: 'No' });
      expect(res.status).toBe(400);
    }
  });

  it('404s for an order that is not there', async () => {
    const res = await post(
      '/api/orders/admin/00000000-0000-0000-0000-000000000000/refunds',
      { reason: 'Nothing here' }
    );
    expect(res.status).toBe(404);
  });
});

describe('the record of it', () => {
  it('cannot be edited or deleted afterwards', async () => {
    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Original' });

    await expect(
      getDb().query('UPDATE order_refunds SET reason = :reason WHERE id = :id', {
        replacements: { id: res.body.refund._id, reason: 'Rewritten' },
      })
    ).rejects.toThrow(/append-only/);

    await expect(
      getDb().query('DELETE FROM order_refunds WHERE id = :id', {
        replacements: { id: res.body.refund._id },
      })
    ).rejects.toThrow(/append-only/);
  });

  it('says who authorised it, and is audited', async () => {
    const order = await aPaidOrder();
    const res = await post(`/api/orders/admin/${order._id}/refunds`, { reason: 'Audited' });

    const [refund] = await rows('SELECT refunded_by FROM order_refunds WHERE id = :id', {
      id: res.body.refund._id,
    });
    expect(refund.refunded_by).toBeTruthy();

    const [entry] = await rows(
      `SELECT action::text FROM audit_logs
        WHERE resource_type = 'order_refund' ORDER BY created_at DESC LIMIT 1`
    );
    expect(entry.action).toBe('UPDATE');
  });

  it('shows what is left to give back', async () => {
    const order = await aPaidOrder();
    const before = await get(`/api/orders/admin/${order._id}/refunds`);

    expect(before.body.refundable).toBe(110000);
    expect(before.body.refunded).toBe(0);
    expect(before.body.refunds).toEqual([]);
  });
});

describe('who may refund', () => {
  it('needs orders.manage, not just orders.view', async () => {
    const support = await signInAsOperator('support');
    const order = await aPaidOrder();

    const res = await api('post', `/api/orders/admin/${order._id}/refunds`)
      .set('Cookie', support)
      .send({ reason: 'Should not work' });

    expect(res.status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    const order = await aPaidOrder();
    const res = await api('post', `/api/orders/admin/${order._id}/refunds`).send({
      reason: 'Nope',
    });

    expect(res.status).toBe(401);
  });
});
