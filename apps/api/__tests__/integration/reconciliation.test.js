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

// Does the bank agree?
//
// The ledger says what the business thinks it has; the bank says what it
// actually has. The whole exercise is matching one against the other until what
// is left over explains the difference — so the assertions here are mostly
// about the leftovers, and about the two ways this goes wrong quietly:
// reconciling doubled data because a statement was imported twice, and signing
// off a reconciliation that does not actually reconcile.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.70.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);
const del = (path) => api('delete', path).set('Cookie', adminCookie);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `bank-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `bank-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
}

const today = () => new Date().toISOString().slice(0, 10);

/** A sale settled by transfer, which is one posting into 1120. */
const aTransferReceipt = async (net) =>
  (
    await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: net }],
      customer: { fullName: 'Bank Buyer' },
      paymentMethod: 'bank_transfer',
    })
  ).body;

const statementLine = (overrides = {}) => ({
  date: today(),
  description: 'Transfer in',
  amount: 1000,
  direction: 'in',
  ...overrides,
});

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  sofaId = await insertProduct({
    name: 'Reconciled Sofa',
    price: 20000000,
    cost_price: 8000000,
    sku: 'RECON-1',
  });

  await recordMovement(sofaId, 100, 'purchase_receipt');
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

// ---------------------------------------------------------------------------
// Importing
// ---------------------------------------------------------------------------

describe('importing a statement', () => {
  it('records the lines against the account', async () => {
    const res = await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [
        statementLine({ description: 'Salary run', amount: 5000, direction: 'out' }),
        statementLine({ description: 'Customer transfer', amount: 7500 }),
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.duplicates).toBe(0);
  });

  it('will not import the same statement twice', async () => {
    // The most common way a reconciliation goes wrong is doing it on doubled
    // data: the totals still look plausible and every figure is twice what it
    // should be.
    const line = statementLine({ amount: 4321, bankReference: `REF-${Date.now()}` });

    const first = await post('/api/reconciliation/statement', { account: '1120', lines: [line] });
    const again = await post('/api/reconciliation/statement', { account: '1120', lines: [line] });

    expect(first.body.imported).toBe(1);
    expect(again.body.imported).toBe(0);
    expect(again.body.duplicates).toBe(1);
    expect(again.body.message).toMatch(/already there/i);
  });

  it('takes a line with no bank reference at face value, twice over', async () => {
    // Some statements carry no per-transaction identifier, and refusing the
    // second identical line would silently drop a real repeated payment.
    const line = statementLine({ description: 'Two identical rents', amount: 999 });

    const first = await post('/api/reconciliation/statement', { account: '1120', lines: [line] });
    const again = await post('/api/reconciliation/statement', { account: '1120', lines: [line] });

    expect(first.body.imported).toBe(1);
    expect(again.body.imported).toBe(1);
  });

  it('refuses an account that is not cash or bank', async () => {
    const res = await post('/api/reconciliation/statement', {
      account: '4100',
      lines: [statementLine()],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a bank or cash account/i);
  });

  it('refuses a line with no direction, no date, or no amount', async () => {
    const cases = [
      statementLine({ direction: undefined }),
      statementLine({ date: undefined }),
      statementLine({ amount: 0 }),
    ];

    for (const line of cases) {
      const res = await post('/api/reconciliation/statement', { account: '1120', lines: [line] });
      expect(res.status).toBe(400);
    }
  });

  it('refuses an import with nothing in it', async () => {
    const res = await post('/api/reconciliation/statement', { account: '1120', lines: [] });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// The workspace
// ---------------------------------------------------------------------------

describe('the workspace', () => {
  it('shows both sides, and what neither has claimed', async () => {
    const res = await get('/api/reconciliation?account=1120');

    expect(res.status).toBe(200);
    expect(res.body.account.code).toBe('1120');
    expect(Array.isArray(res.body.statement)).toBe(true);
    expect(Array.isArray(res.body.ledger)).toBe(true);
    expect(res.body.unmatched).toHaveProperty('unrecorded');
    expect(res.body.unmatched).toHaveProperty('unpresented');
  });

  it('counts a bank line nothing accounts for as money the books have not heard about', async () => {
    const before = (await get('/api/reconciliation?account=1120')).body.unmatched.unrecorded;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Bank charge', amount: 250, direction: 'out' })],
    });

    const after = (await get('/api/reconciliation?account=1120')).body.unmatched.unrecorded;
    expect(after).toBeCloseTo(before - 250, 2);
  });

  it('counts a posting the bank has not seen as money still in flight', async () => {
    const before = (await get('/api/reconciliation?account=1120')).body.unmatched.unpresented;

    const sale = await aTransferReceipt(60000);
    const after = (await get('/api/reconciliation?account=1120')).body.unmatched.unpresented;

    expect(after).toBeCloseTo(before + sale.order.totalAmount, 2);
  });
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

describe('matching a line against a posting', () => {
  it('agrees the two, and neither is unmatched afterwards', async () => {
    const sale = await aTransferReceipt(30000);
    const total = sale.order.totalAmount;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: sale.order.orderNumber, amount: total })],
    });

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find((row) => row.amount === total);
    const entry = view.body.unmatched.ledger.find((row) => row.movement === total);

    const matched = await post(`/api/reconciliation/lines/${line._id}/match`, {
      entryId: entry._id,
    });

    expect(matched.status).toBe(200);
    expect(matched.body.matched).toBe(true);

    const after = await get('/api/reconciliation?account=1120');
    expect(after.body.unmatched.statement.some((row) => row._id === line._id)).toBe(false);
    expect(after.body.unmatched.ledger.some((row) => row._id === entry._id)).toBe(false);
  });

  it('refuses two amounts that do not agree', async () => {
    const sale = await aTransferReceipt(31000);

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Nearly right', amount: 12345 })],
    });

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find((row) => row.amount === 12345);
    const entry = view.body.unmatched.ledger.find(
      (row) => row.movement === sale.order.totalAmount
    );

    const res = await post(`/api/reconciliation/lines/${line._id}/match`, { entryId: entry._id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not agree/i);
  });

  it('refuses money in matched against money out', async () => {
    // ₦5,000 in against ₦5,000 out reconciles to nothing while hiding a
    // ₦10,000 error, which is the worst possible outcome of a match.
    const sale = await aTransferReceipt(32000);
    const total = sale.order.totalAmount;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Wrong way', amount: total, direction: 'out' })],
    });

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find(
      (row) => row.amount === total && row.direction === 'out'
    );
    const entry = view.body.unmatched.ledger.find((row) => row.movement === total);

    const res = await post(`/api/reconciliation/lines/${line._id}/match`, { entryId: entry._id });
    expect(res.status).toBe(400);
  });

  it('refuses a second line claiming a posting that is already matched', async () => {
    const sale = await aTransferReceipt(33000);
    const total = sale.order.totalAmount;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [
        statementLine({ description: 'Twin A', amount: total, bankReference: `A-${Date.now()}` }),
        statementLine({ description: 'Twin B', amount: total, bankReference: `B-${Date.now()}` }),
      ],
    });

    const view = await get('/api/reconciliation?account=1120');
    const entry = view.body.unmatched.ledger.find((row) => row.movement === total);
    const twins = view.body.unmatched.statement.filter((row) =>
      String(row.description).startsWith('Twin')
    );

    const first = await post(`/api/reconciliation/lines/${twins[0]._id}/match`, {
      entryId: entry._id,
    });
    const second = await post(`/api/reconciliation/lines/${twins[1]._id}/match`, {
      entryId: entry._id,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already matched/i);
  });

  it('refuses an entry that never touched this account', async () => {
    // An expense approval posts to payables and an expense account; nothing of
    // it reaches the bank until it is paid.
    const vendor = await post('/api/purchasing/vendors', { name: `Elsewhere ${Date.now()}` });
    const expense = await post('/api/purchasing/expenses', {
      vendorId: vendor.body.vendor._id,
      accountCode: '5600',
      description: 'Rent',
      date: today(),
      netAmount: 5000,
    });
    await post(`/api/purchasing/expenses/${expense.body.expense._id}/approve`);

    const [entry] = await rows(
      `SELECT id FROM journal_entries WHERE source = 'expense' ORDER BY created_at DESC LIMIT 1`
    );

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Unrelated', amount: 5000 })],
    });

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find((row) => row.description === 'Unrelated');

    const res = await post(`/api/reconciliation/lines/${line._id}/match`, { entryId: entry.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not touch/i);
  });

  it('unmatches, for when the wrong two things were put together', async () => {
    const sale = await aTransferReceipt(34000);
    const total = sale.order.totalAmount;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Undo me', amount: total })],
    });

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find((row) => row.description === 'Undo me');
    const entry = view.body.unmatched.ledger.find((row) => row.movement === total);

    await post(`/api/reconciliation/lines/${line._id}/match`, { entryId: entry._id });
    const undone = await del(`/api/reconciliation/lines/${line._id}/match`);

    expect(undone.status).toBe(200);
    expect(undone.body.matched).toBe(false);

    const after = await get('/api/reconciliation?account=1120');
    expect(after.body.unmatched.statement.some((row) => row._id === line._id)).toBe(true);
  });

  it('404s unmatching something that was never matched', async () => {
    const res = await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Never matched', amount: 111 })],
    });
    expect(res.status).toBe(201);

    const view = await get('/api/reconciliation?account=1120');
    const line = view.body.unmatched.statement.find((row) => row.description === 'Never matched');

    expect((await del(`/api/reconciliation/lines/${line._id}/match`)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

describe('suggestions', () => {
  it('pairs a line with a posting of the same amount, direction and date', async () => {
    const sale = await aTransferReceipt(41000);
    const total = sale.order.totalAmount;

    await post('/api/reconciliation/statement', {
      account: '1120',
      lines: [statementLine({ description: 'Suggest me', amount: total })],
    });

    const res = await get('/api/reconciliation/suggestions?account=1120');
    expect(res.status).toBe(200);

    const suggestion = res.body.suggestions.find((row) => row.amount === total);
    expect(suggestion).toBeDefined();
    expect(suggestion.daysApart).toBe(0);

    // Suggested, not matched — two payments of the same amount in the same week
    // are common, and a wrong match agrees a balance that was never true.
    const view = await get('/api/reconciliation?account=1120');
    expect(view.body.unmatched.statement.some((row) => row._id === suggestion.lineId)).toBe(true);
  });

  it('offers each line and each posting once', async () => {
    const res = await get('/api/reconciliation/suggestions?account=1120');

    const lineIds = res.body.suggestions.map((row) => row.lineId);
    const entryIds = res.body.suggestions.map((row) => row.entryId);

    expect(new Set(lineIds).size).toBe(lineIds.length);
    expect(new Set(entryIds).size).toBe(entryIds.length);
  });
});

// ---------------------------------------------------------------------------
// Signing off
// ---------------------------------------------------------------------------

describe('completing a reconciliation', () => {
  it('refuses a balance that does not reconcile', async () => {
    const res = await post('/api/reconciliation/complete', {
      account: '1120',
      statementDate: today(),
      statementBalance: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not reconcile/i);
  });

  it('accepts the figure the books, the unpresented and the unrecorded come to', async () => {
    const view = await get('/api/reconciliation?account=1120');
    const { ledgerBalance, unmatched } = view.body;

    // The books, less what the bank has not seen, plus what the books have not
    // seen. Anything else is an error somebody has to find.
    const expected =
      Math.round((ledgerBalance - unmatched.unpresented + unmatched.unrecorded) * 100) / 100;

    const res = await post('/api/reconciliation/complete', {
      account: '1120',
      statementDate: today(),
      statementBalance: expected,
      notes: 'Checked against the app',
    });

    expect(res.status).toBe(201);
    expect(res.body.reconciliation.statementBalance).toBeCloseTo(expected, 2);
    expect(res.body.message).toMatch(/agrees with the bank/i);
  });

  it('will not sign off the same account and date twice', async () => {
    const view = await get('/api/reconciliation?account=1120');
    const expected =
      Math.round(
        (view.body.ledgerBalance -
          view.body.unmatched.unpresented +
          view.body.unmatched.unrecorded) *
          100
      ) / 100;

    const again = await post('/api/reconciliation/complete', {
      account: '1120',
      statementDate: today(),
      statementBalance: expected,
    });

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already been reconciled/i);
  });

  it('needs a statement date', async () => {
    const res = await post('/api/reconciliation/complete', {
      account: '1120',
      statementBalance: 0,
    });
    expect(res.status).toBe(400);
  });

  it('lists what has been signed off', async () => {
    const res = await get('/api/reconciliation/history?account=1120');

    expect(res.status).toBe(200);
    expect(res.body.reconciliations.length).toBeGreaterThan(0);
    expect(res.body.reconciliations[0].account).toBe('1120');
    expect(res.body.reconciliations[0].completedBy).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Who may do it
// ---------------------------------------------------------------------------

describe('permissions', () => {
  it('lets an admin read the workspace but not sign anything off', async () => {
    // Reading is a finance question; asserting that the books agree with the
    // bank is the owner's, so books.manage is on no role list but super_admin.
    const financeCookie = await signInAsOperator('admin');

    const read = await api('get', '/api/reconciliation?account=1120').set('Cookie', financeCookie);
    const write = await api('post', '/api/reconciliation/complete')
      .set('Cookie', financeCookie)
      .send({ account: '1120', statementDate: today(), statementBalance: 0 });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });

  it('keeps the whole thing behind the console door', async () => {
    expect((await api('get', '/api/reconciliation')).status).toBe(401);
  });
});
