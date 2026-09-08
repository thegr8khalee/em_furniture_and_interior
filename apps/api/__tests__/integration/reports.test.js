import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb, insertProduct } from '../helpers/database.js';

// The two reports the books were missing.
//
// `1200` carried a balance that nothing could break down, so "who owes us?" —
// the question that decides who gets chased this week — had no answer. And
// there was no cash flow statement, which is the one a small business feels
// first: a profitable month can still empty the bank if the profit went into
// stock, and neither the profit and loss nor the balance sheet can show that.
//
// A sofa at ₦100,000, VAT at 10%, so one of them is an order of ₦110,000.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.80.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);

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

async function anOrder(quantity = 1) {
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

  return placed.body.order;
}

const confirm = (order) =>
  api('put', `/api/orders/admin/${order._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'confirmed' });

const pay = (order, amount) =>
  api('post', `/api/orders/admin/${order._id}/payments`)
    .set('Cookie', adminCookie)
    .send({ amount });

/** Ages an order by moving when it was placed. */
const backdate = (order, days) =>
  getDb().query(
    `UPDATE orders SET created_at = now() - (:days || ' days')::interval WHERE id = :id`,
    { replacements: { id: order._id, days } }
  );

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '10';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
  sofaId = await insertProduct({
    name: 'Reporting Sofa',
    price: 10000000,
    cost_price: 4000000,
    sku: 'REP-1',
  });
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('who owes us', () => {
  it('lists an order whose sale is recognised and not yet paid', async () => {
    const order = await anOrder();
    await confirm(order);

    const res = await get('/api/books/receivables');

    expect(res.status).toBe(200);
    const owed = res.body.customers.find((c) =>
      c.orders.some((o) => o.orderNumber === order.orderNumber)
    );
    expect(owed.total).toBe(110000);
    expect(owed.current).toBe(110000);
  });

  // An unconfirmed order is not owed yet, however much it is worth — nothing
  // has been recognised, so there is no debt.
  it('ignores an order the books have not recognised', async () => {
    const order = await anOrder();

    const res = await get('/api/books/receivables');
    const found = res.body.customers.find((c) =>
      c.orders.some((o) => o.orderNumber === order.orderNumber)
    );

    expect(found).toBeUndefined();
  });

  it('drops an order once it is paid', async () => {
    const order = await anOrder();
    await confirm(order);
    await pay(order, 110000);

    const res = await get('/api/books/receivables');
    const found = res.body.customers.find((c) =>
      c.orders.some((o) => o.orderNumber === order.orderNumber)
    );

    expect(found).toBeUndefined();
  });

  it('shows only what is left after a part payment', async () => {
    const order = await anOrder();
    await confirm(order);
    await pay(order, 40000);

    const res = await get('/api/books/receivables');
    const line = res.body.customers
      .flatMap((c) => c.orders)
      .find((o) => o.orderNumber === order.orderNumber);

    expect(line.outstanding).toBe(70000);
  });

  it('puts a debt in the right age bucket', async () => {
    const order = await anOrder();
    await confirm(order);
    await backdate(order, 45);

    const res = await get('/api/books/receivables');
    const owed = res.body.customers.find((c) =>
      c.orders.some((o) => o.orderNumber === order.orderNumber)
    );

    expect(owed.thirtyDays).toBe(110000);
    expect(owed.current).toBe(0);
  });

  it('ages past ninety days', async () => {
    const order = await anOrder();
    await confirm(order);
    await backdate(order, 120);

    const res = await get('/api/books/receivables');
    const owed = res.body.customers.find((c) =>
      c.orders.some((o) => o.orderNumber === order.orderNumber)
    );

    expect(owed.ninetyDaysPlus).toBe(110000);
  });

  // The report and the ledger describe the same thing from different sides, so
  // they have to agree. This is the check that would catch a posting rule and a
  // report drifting apart.
  it('comes to what the ledger says is receivable', async () => {
    const order = await anOrder();
    await confirm(order);

    const [ledger] = await rows(
      `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0)::bigint AS balance
         FROM journal_lines l
         JOIN accounts a ON a.id = l.account_id
        WHERE a.code = '1200'`
    );

    const res = await get('/api/books/receivables');

    expect(res.body.totals.total).toBe(Number(ledger.balance) / 100);
  });

  it('needs finance.view', async () => {
    const editor = await signInAsOperator('editor');
    expect((await api('get', '/api/books/receivables').set('Cookie', editor)).status).toBe(403);
  });
});

describe('where the cash went', () => {
  it('opens where the last period closed and closes where the bank is', async () => {
    const res = await get('/api/books/reports/cash-flow?from=2020-01-01&to=2030-12-31');

    expect(res.status).toBe(200);

    const [bank] = await rows(
      `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0)::bigint AS balance
         FROM journal_lines l
         JOIN accounts a ON a.id = l.account_id
        WHERE a.code IN ('1110', '1120', '1130')`
    );

    // Over a window that covers everything, the closing figure is the bank.
    expect(res.body.closingBalance).toBe(Number(bank.balance) / 100);
  });

  it('adds up: opening plus the net change is the closing balance', async () => {
    const order = await anOrder();
    await confirm(order);
    await pay(order, 110000);

    const res = await get('/api/books/reports/cash-flow?from=2020-01-01&to=2030-12-31');

    expect(res.body.openingBalance + res.body.netChange).toBe(res.body.closingBalance);
  });

  it('sums its own sections to the net change', async () => {
    const res = await get('/api/books/reports/cash-flow?from=2020-01-01&to=2030-12-31');

    const sections =
      Number(res.body.operating.total) +
      Number(res.body.investing.total) +
      Number(res.body.financing.total);

    expect(sections).toBe(res.body.netChange);
  });

  it('puts money from a sale under operating', async () => {
    const order = await anOrder();
    await confirm(order);
    await pay(order, 110000);

    const res = await get('/api/books/reports/cash-flow?from=2020-01-01&to=2030-12-31');

    expect(Number(res.body.operating.total)).toBeGreaterThan(0);
    // Settling a receivable is what the cash was paired with.
    expect(res.body.operating.lines.some((line) => line.code === '1200')).toBe(true);
  });

  // Capital introduced is not trading income, and a cash flow that called it
  // operating would say the business earns money it does not earn.
  it('puts capital introduced under financing', async () => {
    const { postEntry } = await import('../../src/services/ledger.js');
    await postEntry(getDb(), {
      date: new Date().toISOString().slice(0, 10),
      description: 'Owner puts money in',
      source: 'manual',
      lines: [
        { account: '1120', debit: 5000000, description: 'Into the bank' },
        { account: '3100', credit: 5000000, description: 'Owner capital' },
      ],
    });

    const res = await get('/api/books/reports/cash-flow?from=2020-01-01&to=2030-12-31');

    expect(Number(res.body.financing.total)).toBeGreaterThanOrEqual(50000);
    expect(res.body.financing.lines.some((line) => line.code === '3100')).toBe(true);
  });

  it('refuses a date range that is not one', async () => {
    expect((await get('/api/books/reports/cash-flow?from=not-a-date')).status).toBe(400);
  });

  it('needs finance.view', async () => {
    const editor = await signInAsOperator('editor');
    const res = await api('get', '/api/books/reports/cash-flow').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});
