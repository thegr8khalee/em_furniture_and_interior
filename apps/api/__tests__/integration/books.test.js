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
} from '../helpers/database.js';

// The books.
//
// One sale is driven all the way through — confirmed, paid, stock gone — and
// then every report is asked about it. The point of a ledger is that the
// reports and the postings cannot disagree, so each assertion here is really
// asking whether the posting rules were right.
//
// The figures throughout: a sofa costing ₦60,000 sold for ₦100,000, VAT at 10%.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;
let order;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '10';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  sofaId = await insertProduct({
    name: 'Ledger Sofa',
    price: 10000000, // ₦100,000
    cost_price: 6000000, // ₦60,000
    sku: 'LEDGER-1',
  });

  order = await sell();
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.10.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

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

/** A sale, all the way: placed, confirmed, paid, stock gone. */
async function sell(quantity = 1) {
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

  const placedOrder = placed.body.order;

  await api('put', `/api/orders/admin/${placedOrder._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'confirmed' });
  await api('put', `/api/orders/admin/${placedOrder._id}/payment`)
    .set('Cookie', adminCookie)
    .send({ paymentStatus: 'paid' });

  return placedOrder;
}

const get = (path) => api('get', path).set('Cookie', adminCookie);

describe('the trial balance', () => {
  it('balances, and shows the accounts one sale touched', async () => {
    const res = await get('/api/books/trial-balance');

    expect(res.status).toBe(200);
    expect(res.body.balanced).toBe(true);
    expect(res.body.totalDebit).toBe(res.body.totalCredit);

    const by = Object.fromEntries(res.body.accounts.map((a) => [a.code, a]));

    // Revenue ₦100,000, VAT ₦10,000, cost ₦60,000, cash in ₦110,000.
    expect(by['4100'].balance).toBe(100000);
    expect(by['2200'].balance).toBe(10000);
    expect(by['5100'].balance).toBe(60000);
    expect(by['1300'].balance).toBe(-60000);
    expect(by['1120'].balance).toBe(110000);
  });

  it('clears the receivable once the order is paid', async () => {
    const res = await get('/api/books/trial-balance');
    const receivable = res.body.accounts.find((a) => a.code === '1200');

    // Raised on confirmation and cleared on payment, so it nets to nothing —
    // which it never did while only a gateway charge posted a receipt.
    expect(receivable === undefined || receivable.balance === 0).toBe(true);
  });

  it('reports the position as at an earlier date', async () => {
    const res = await get('/api/books/trial-balance?asOf=2020-01-01');

    expect(res.body.accounts).toHaveLength(0);
    expect(res.body.balanced).toBe(true);
  });
});

describe('the journal', () => {
  it('lists the entries a sale produced, newest first', async () => {
    const res = await get('/api/books/journal');

    expect(res.status).toBe(200);
    const sources = res.body.entries.map((e) => e.source);
    expect(sources).toContain('sales_order');
    expect(sources).toContain('payment');
    expect(sources).toContain('stock_movement');
    expect(res.body.entries[0].entryNumber).toMatch(/^JE-\d{6}$/);
  });

  it('filters by source, by date and by account', async () => {
    const bySource = await get('/api/books/journal?source=payment');
    const byAccount = await get('/api/books/journal?account=5100');
    const byDate = await get('/api/books/journal?from=2020-01-01&to=2020-12-31');

    expect(bySource.body.entries.every((e) => e.source === 'payment')).toBe(true);
    expect(byAccount.body.entries.length).toBeGreaterThan(0);
    expect(byDate.body.entries).toHaveLength(0);
  });

  it('opens one entry and shows the lines that make it up', async () => {
    const listed = await get('/api/books/journal?source=sales_order');
    const res = await get(`/api/books/journal/${listed.body.entries[0]._id}`);

    expect(res.status).toBe(200);

    const debits = res.body.entry.lines.reduce((n, l) => n + l.debit, 0);
    const credits = res.body.entry.lines.reduce((n, l) => n + l.credit, 0);
    expect(debits).toBe(credits);
    expect(res.body.entry.lines.map((l) => l.account)).toContain('1200');
  });

  it('404s for an entry that does not exist', async () => {
    const res = await get('/api/books/journal/11111111-1111-4111-8111-111111111111');

    expect(res.status).toBe(404);
  });
});

describe('an account ledger', () => {
  it('runs a balance down the account, line by line', async () => {
    const res = await get('/api/books/accounts/4100/ledger');

    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ code: '4100', normalBalance: 'credit' });
    expect(res.body.openingBalance).toBe(0);
    expect(res.body.closingBalance).toBe(res.body.lines.at(-1).balance);
  });

  it('404s for an account code that does not exist', async () => {
    const res = await get('/api/books/accounts/9999/ledger');

    expect(res.status).toBe(404);
  });

  it('lists the whole chart with what each account holds', async () => {
    const res = await get('/api/books/accounts');

    expect(res.body.accounts.length).toBeGreaterThan(25);
    expect(res.body.accounts.find((a) => a.code === '1000')).toMatchObject({
      name: 'Assets',
      isPostable: false,
    });
  });
});

describe('the profit and loss', () => {
  it('separates cost of sales from operating costs, and nets to the profit', async () => {
    const res = await get('/api/books/reports/profit-and-loss');

    expect(res.status).toBe(200);
    expect(res.body.revenue.total).toBe(100000);
    expect(res.body.costOfSales.total).toBe(60000);
    expect(res.body.grossProfit).toBe(40000);
    expect(res.body.netProfit).toBe(
      res.body.grossProfit - res.body.operatingExpenses.total
    );
  });

  it('excludes VAT from revenue — it was never the shop’s money', async () => {
    const res = await get('/api/books/reports/profit-and-loss');

    expect(res.body.revenue.lines.map((l) => l.code)).not.toContain('2200');
  });

  it('reports nothing for a window with no trading in it', async () => {
    const res = await get('/api/books/reports/profit-and-loss?from=2020-01-01&to=2020-12-31');

    expect(res.body.revenue.total).toBe(0);
    expect(res.body.netProfit).toBe(0);
  });

  it('refuses a range that runs backwards', async () => {
    const res = await get('/api/books/reports/profit-and-loss?from=2026-12-01&to=2026-01-01');

    expect(res.status).toBe(400);
  });
});

describe('the balance sheet', () => {
  it('balances: assets equal liabilities plus equity', async () => {
    const res = await get('/api/books/reports/balance-sheet');

    expect(res.status).toBe(200);
    expect(res.body.balanced).toBe(true);
    expect(res.body.assets.total).toBe(res.body.liabilities.total + res.body.equity.total);
  });

  it('carries the profit into retained earnings without a closing entry', async () => {
    const [sheet, pnl] = await Promise.all([
      get('/api/books/reports/balance-sheet'),
      get('/api/books/reports/profit-and-loss?from=2020-01-01'),
    ]);

    const retained = sheet.body.equity.lines.find((l) => l.code === '3200');
    expect(retained.amount).toBe(pnl.body.netProfit);
  });

  it('shows what the business held on a given date', async () => {
    const res = await get('/api/books/reports/balance-sheet?asOf=2020-01-01');

    expect(res.body.assets.total).toBe(0);
    expect(res.body.balanced).toBe(true);
  });
});

describe('the VAT return', () => {
  it('reports what was charged to customers', async () => {
    const res = await get('/api/books/reports/vat');

    expect(res.status).toBe(200);
    expect(res.body.taxableSales).toBe(100000);
    expect(res.body.outputVat).toBe(10000);
    // Nothing records a purchase yet, so there is nothing to reclaim.
    expect(res.body.inputVat).toBe(0);
    expect(res.body.netPayable).toBe(10000);
  });
});

describe('closing a month', () => {
  const monthOf = (offset) => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const periodNamed = async (name) => {
    const [row] = await rows('SELECT id FROM accounting_periods WHERE name = :name', { name });
    return row.id;
  };

  it('lists the calendar with what has been posted into each month', async () => {
    const res = await get('/api/books/periods');

    expect(res.status).toBe(200);
    const thisMonth = res.body.periods.find((p) => p.name === monthOf(0));
    expect(thisMonth).toMatchObject({ status: 'open' });
    expect(thisMonth.entryCount).toBeGreaterThan(0);
  });

  it('will not close a month that has not finished', async () => {
    const res = await api('post', `/api/books/periods/${await periodNamed(monthOf(0))}/close`).set(
      'Cookie',
      adminCookie
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not finished/i);
  });

  it('closes a finished month, and then refuses a posting into it', async () => {
    const lastMonth = await periodNamed(monthOf(-1));

    const closed = await api('post', `/api/books/periods/${lastMonth}/close`).set(
      'Cookie',
      adminCookie
    );
    expect(closed.status).toBe(200);
    expect(closed.body.period.status).toBe('closed');
    expect(closed.body.period.closedBy).not.toBeNull();

    const { postEntry } = await import('../../src/services/ledger.js');
    const backdated = new Date();
    backdated.setUTCMonth(backdated.getUTCMonth() - 1, 15);

    await expect(
      postEntry(getDb(), {
        date: backdated.toISOString().slice(0, 10),
        description: 'Slipped in after the close',
        lines: [
          { account: '1110', debit: 100 },
          { account: '4100', credit: 100 },
        ],
      })
    ).rejects.toThrow(/closed/i);
  });

  it('refuses to close the same month twice, and reopens it deliberately', async () => {
    const lastMonth = await periodNamed(monthOf(-1));

    const again = await api('post', `/api/books/periods/${lastMonth}/close`).set(
      'Cookie',
      adminCookie
    );
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already closed/i);

    const reopened = await api('post', `/api/books/periods/${lastMonth}/reopen`).set(
      'Cookie',
      adminCookie
    );
    expect(reopened.body.period.status).toBe('open');
    expect(reopened.body.period.closedAt).toBeNull();
  });

  it('lets an ordinary admin read the books but not close them', async () => {
    const manager = await signInAsOperator('admin');
    const lastMonth = await periodNamed(monthOf(-1));

    const read = await api('get', '/api/books/trial-balance').set('Cookie', manager);
    const close = await api('post', `/api/books/periods/${lastMonth}/close`).set(
      'Cookie',
      manager
    );

    expect(read.status).toBe(200);
    expect(close.status).toBe(403);
    expect(close.body.requiredPermissions).toEqual(['books.manage']);
  });

  it('is closed entirely to an operator with no finance permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/books/trial-balance').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});

describe('a second sale', () => {
  it('adds to the same accounts rather than replacing them', async () => {
    const before = await get('/api/books/reports/profit-and-loss');
    await sell(2);
    const after = await get('/api/books/reports/profit-and-loss');

    expect(after.body.revenue.total).toBe(before.body.revenue.total + 200000);
    expect(after.body.costOfSales.total).toBe(before.body.costOfSales.total + 120000);
    expect(after.body.grossProfit).toBe(before.body.grossProfit + 80000);

    const sheet = await get('/api/books/reports/balance-sheet');
    expect(sheet.body.balanced).toBe(true);
  });
});
