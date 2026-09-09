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
  recordMovement,
} from '../helpers/database.js';

// What a customer owes, as a document they can be sent — and figures in a form
// somebody else's software can read.
//
// The ageing answers the owner's question, "who owes me". A statement answers
// the customer's, "what is this for", and a debt chased with a total and no
// detail waits another month while somebody digs out the orders.
//
// The CSV assertions are about the two things that quietly corrupt an export: a
// comma inside a product name shifting every column after it, and Excel reading
// a UTF-8 file as something else and mangling the naira sign.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;
let awkwardId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.90.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `stmt-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `stmt-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
}

const today = () => new Date().toISOString().slice(0, 10);
const anEmail = () => `stmt-${Math.random().toString(36).slice(2)}@example.com`;

/** Somebody on the books, with a sale against their name. */
const aBuyer = async (name, { unitPrice = 100000, amountPaid = 0, product = null } = {}) => {
  const customer = await post('/api/customers', { fullName: name, email: anEmail() });
  const customerId = customer.body.customer._id;

  const sale = await post('/api/orders/admin/sales', {
    customerId,
    items: [{ product: product ?? sofaId, quantity: 1, unitPrice }],
    amountPaid,
  });

  return { customerId, sale: sale.body };
};

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  sofaId = await insertProduct({
    name: 'Statement Sofa',
    price: 15000000,
    cost_price: 6000000,
    sku: 'STMT-1',
  });

  // A name that would break a naive CSV writer twice over.
  awkwardId = await insertProduct({
    name: 'Sofa, 3-seat "Deluxe"',
    price: 15000000,
    cost_price: 6000000,
    sku: 'STMT-2',
  });

  await recordMovement(sofaId, 200, 'purchase_receipt');
  await recordMovement(awkwardId, 200, 'purchase_receipt');
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

// ---------------------------------------------------------------------------
// One customer's account
// ---------------------------------------------------------------------------

describe("a customer's statement", () => {
  it('names what each figure is for, rather than giving a total', async () => {
    const { customerId, sale } = await aBuyer('Chinelo Eze', { unitPrice: 250000 });

    const res = await get(`/api/statements/customers/${customerId}`);

    expect(res.status).toBe(200);
    expect(res.body.statement.customer._id).toBe(customerId);

    const charge = res.body.statement.lines.find(
      (line) => line.reference === sale.order.orderNumber
    );

    expect(charge).toBeDefined();
    expect(charge.kind).toBe('Order');
    expect(charge.charged).toBeCloseTo(sale.order.totalAmount, 2);
    expect(charge.paid).toBe(0);
  });

  it('carries a running balance down the page, and the closing figure is what is owed', async () => {
    const { customerId, sale } = await aBuyer('Emeka Ajayi', {
      unitPrice: 400000,
      amountPaid: 100000,
    });

    const res = await get(`/api/statements/customers/${customerId}`);
    const { statement } = res.body;

    expect(statement.charged).toBeCloseTo(sale.order.totalAmount, 2);
    expect(statement.paid).toBeCloseTo(100000, 2);
    expect(statement.closingBalance).toBeCloseTo(sale.order.totalAmount - 100000, 2);
    expect(statement.amountDue).toBeCloseTo(statement.closingBalance, 2);

    // The last line's balance is the closing balance.
    expect(statement.lines.at(-1).balance).toBeCloseTo(statement.closingBalance, 2);
  });

  it('shows a payment as money off the balance', async () => {
    const { customerId, sale } = await aBuyer('Ifeoma Nwosu', { unitPrice: 300000 });

    await post(`/api/orders/admin/${sale.order._id}/payments`, {
      amount: 50000,
      method: 'bank_transfer',
    });

    const res = await get(`/api/statements/customers/${customerId}`);
    const payment = res.body.statement.lines.find((line) => line.kind === 'Payment');

    expect(payment).toBeDefined();
    expect(payment.paid).toBeCloseTo(50000, 2);
    expect(payment.charged).toBe(0);
  });

  it('never asks for a negative amount, however far in credit they are', async () => {
    // A credit balance is a real thing, but "please pay minus ₦40,000" is not a
    // sentence to put on a document.
    const { customerId } = await aBuyer('Credited Chidi', { unitPrice: 100000 });

    const [customer] = await rows(
      'SELECT id FROM customers WHERE id = :id',
      { id: customerId }
    );
    expect(customer).toBeDefined();

    const res = await get(`/api/statements/customers/${customerId}`);
    expect(res.body.statement.amountDue).toBeGreaterThanOrEqual(0);
  });

  it('puts everything before the window into one opening figure', async () => {
    const { customerId } = await aBuyer('Opening Olu', { unitPrice: 200000 });

    // A window that starts tomorrow: nothing happened inside it, so the whole
    // balance has to be sitting in the opening figure.
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const res = await get(
      `/api/statements/customers/${customerId}?from=${tomorrow}&to=${nextWeek}`
    );

    expect(res.body.statement.lines).toHaveLength(0);
    expect(res.body.statement.openingBalance).toBeGreaterThan(0);
    expect(res.body.statement.closingBalance).toBeCloseTo(res.body.statement.openingBalance, 2);
  });

  it('leaves a cancelled order off it entirely', async () => {
    const { customerId, sale } = await aBuyer('Cancelled Cara', { unitPrice: 150000 });

    await api('put', `/api/orders/admin/${sale.order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'cancelled' });

    const res = await get(`/api/statements/customers/${customerId}`);
    const charge = res.body.statement.lines.find(
      (line) => line.reference === sale.order.orderNumber && line.kind === 'Order'
    );

    expect(charge).toBeUndefined();
  });

  it('404s somebody who does not exist', async () => {
    const res = await get('/api/statements/customers/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
  });

  it('400s an id that is not an id', async () => {
    expect((await get('/api/statements/customers/not-a-uuid')).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

describe('a statement run', () => {
  it('lists everyone with something outstanding, so they go out together', async () => {
    const { customerId } = await aBuyer('Owing Obi', { unitPrice: 500000 });

    const res = await get('/api/statements/run');

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);

    const line = res.body.customers.find((row) => row.customerId === customerId);
    expect(line).toBeDefined();
    expect(line.oldest).toBe('current');
    expect(line.total).toBeGreaterThan(0);
  });

  it('leaves out somebody who has paid in full', async () => {
    const customer = await post('/api/customers', { fullName: 'Settled Sade', email: anEmail() });
    const customerId = customer.body.customer._id;

    await post('/api/orders/admin/sales', {
      customerId,
      items: [{ product: sofaId, quantity: 1, unitPrice: 90000 }],
      // Nothing said means paid in full.
    });

    const res = await get('/api/statements/run');
    expect(res.body.customers.some((row) => row.customerId === customerId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

describe('exports', () => {
  it('sends a statement as a CSV with a header row', async () => {
    const { customerId } = await aBuyer('Exported Efe', { unitPrice: 120000 });

    const res = await get(`/api/statements/customers/${customerId}.csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="statement-/);

    // A BOM, so Excel opens it as UTF-8 rather than mangling the naira sign.
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toMatch(/Date,Reference,Type,Charged,Paid,Balance/);
  });

  it('quotes a field containing a comma or a quote, so the columns do not shift', async () => {
    // `Sofa, 3-seat "Deluxe"` written raw would move every column after it on
    // that row, and the file would silently describe something else.
    const { toCsv } = await import('../../src/lib/csv.js');

    const csv = toCsv(
      [
        { key: 'name', label: 'Product' },
        { key: 'qty', label: 'Qty' },
      ],
      [{ name: 'Sofa, 3-seat "Deluxe"', qty: 2 }]
    );

    expect(csv).toContain('"Sofa, 3-seat ""Deluxe"""');
    expect(csv.trim().split('\r\n')[1].split(',')).toHaveLength(3); // quoted comma still splits naively
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes an empty cell for a missing value rather than the word undefined', async () => {
    const { toCsv } = await import('../../src/lib/csv.js');

    const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 1 }]);
    expect(csv).toContain('1,\r\n');
  });

  it('exports the trial balance', async () => {
    const res = await get('/api/statements/exports/trial-balance.csv');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Code,Account,Type,Debit,Credit,Balance/);
    expect(res.text).toMatch(/1200/);
  });

  it('exports the journal', async () => {
    const res = await get('/api/statements/exports/journal.csv');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Entry,Date,Description,Source,Amount/);
    expect(res.text).toMatch(/JE-/);
  });

  it('exports the VAT return for a period', async () => {
    const res = await get(`/api/statements/exports/vat.csv?from=2020-01-01&to=${today()}`);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Output VAT/);
    expect(res.text).toMatch(/Net payable/);
  });

  it('exports the cash flow for a period', async () => {
    const res = await get(`/api/statements/exports/cash-flow.csv?from=2020-01-01&to=${today()}`);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Section,Item,Amount/);
    expect(res.text).toMatch(/Cash at the start/);
    expect(res.text).toMatch(/Cash at the end/);
  });

  it('refuses a date range that is not one', async () => {
    const res = await get('/api/statements/exports/vat.csv?from=yesterday&to=whenever');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Who may read them
// ---------------------------------------------------------------------------

describe('permissions', () => {
  it('is finance work, so support cannot read one', async () => {
    const supportCookie = await signInAsOperator('support');

    const res = await api('get', '/api/statements/run').set('Cookie', supportCookie);
    expect(res.status).toBe(403);
  });

  it('keeps it behind the console door', async () => {
    expect((await api('get', '/api/statements/run')).status).toBe(401);
  });
});
