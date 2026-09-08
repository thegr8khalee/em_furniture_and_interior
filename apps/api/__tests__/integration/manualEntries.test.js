import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb } from '../helpers/database.js';

// Posting by hand.
//
// The escape hatch every set of books needs. The posting rules cover what the
// business does routinely and leave everything an accountant does at month end
// with no way in: rent paid in advance into `1400`, a late bill accrued into
// `2400`, depreciation, a correction. All of those accounts sat in the chart
// unreachable.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let ownerCookie;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.95.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', ownerCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', ownerCookie).send(body);

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

const balanceOf = async (code) => {
  const res = await get('/api/books/trial-balance');
  return res.body.accounts.find((a) => a.code === code)?.balance ?? 0;
};

const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  ownerCookie = await signInAsOperator();
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('posting by hand', () => {
  // The whole point: three accounts that no automatic rule can reach.
  it('reaches prepayments, which nothing else could', async () => {
    const prepaid = await balanceOf('1400');

    const res = await post('/api/books/journal', {
      date: today(),
      description: "Six months' workshop rent paid in advance",
      lines: [
        { account: '1400', debit: 600000, description: 'Rent prepaid' },
        { account: '1120', credit: 600000, description: 'Out of the current account' },
      ],
    });

    expect(res.status).toBe(201);
    expect(await balanceOf('1400')).toBe(prepaid + 600000);
  });

  it('reaches accrued expenses', async () => {
    const accrued = await balanceOf('2400');

    await post('/api/books/journal', {
      date: today(),
      description: 'Electricity used in September, bill not yet arrived',
      lines: [
        { account: '5600', debit: 45000, description: 'Estimated' },
        { account: '2400', credit: 45000, description: 'Owed but not billed' },
      ],
    });

    expect(await balanceOf('2400')).toBe(accrued + 45000);
  });

  it('takes amounts in naira, like everything else on the wire', async () => {
    await post('/api/books/journal', {
      date: today(),
      description: 'A precise amount',
      lines: [
        { account: '1400', debit: 1234.56 },
        { account: '1120', credit: 1234.56 },
      ],
    });

    const [line] = await rows(
      `SELECT l.debit FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.description = 'A precise amount' AND a.code = '1400'`
    );

    // Stored as kobo, exactly.
    expect(Number(line.debit)).toBe(123456);
  });

  it('records who posted it, and marks it manual', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Something by hand',
      lines: [
        { account: '1400', debit: 1000 },
        { account: '1120', credit: 1000 },
      ],
    });

    expect(res.body.entry.source).toBe('manual');
    expect(res.body.entry.createdByName).toBeTruthy();
  });

  it('appends a reference to the description when given one', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Depreciation',
      reference: 'SEP-2026',
      lines: [
        { account: '1400', debit: 500 },
        { account: '1120', credit: 500 },
      ],
    });

    expect(res.body.entry.description).toBe('Depreciation (SEP-2026)');
  });
});

describe('what it refuses', () => {
  // The message names the difference rather than leaving the arithmetic to the
  // person who has just done it wrong.
  it('an entry that does not balance, and says by how much', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Lopsided',
      lines: [
        { account: '1400', debit: 1000 },
        { account: '1120', credit: 900 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not balance/i);
    expect(res.body.message).toMatch(/100/);
  });

  it('a line that is both a debit and a credit, or neither', async () => {
    const both = await post('/api/books/journal', {
      date: today(),
      description: 'Both',
      lines: [
        { account: '1400', debit: 100, credit: 100 },
        { account: '1120', credit: 100 },
      ],
    });
    expect(both.status).toBe(400);

    const neither = await post('/api/books/journal', {
      date: today(),
      description: 'Neither',
      lines: [
        { account: '1400' },
        { account: '1120', credit: 100 },
      ],
    });
    expect(neither.status).toBe(400);
  });

  it('a negative amount, and says to write it the other way round', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Negative',
      lines: [
        { account: '1400', debit: -100 },
        { account: '1120', credit: -100 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/negative debit is a credit/i);
  });

  it('a single line — an entry has two sides', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Half of one',
      lines: [{ account: '1400', debit: 100 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least two lines/i);
  });

  it('an account that is not in the chart', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'Nowhere',
      lines: [
        { account: '9999', debit: 100 },
        { account: '1120', credit: 100 },
      ],
    });

    expect(res.status).toBe(400);
  });

  // A figure booked to a summary account would never appear beneath it in any
  // report — the same rule the expense form is held to.
  it('a summary account', async () => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'To a heading',
      lines: [
        { account: '1000', debit: 100 },
        { account: '1120', credit: 100 },
      ],
    });

    expect(res.status).toBe(400);
  });

  it('no description, or a date it cannot use', async () => {
    expect(
      (await post('/api/books/journal', {
        date: today(),
        lines: [
          { account: '1400', debit: 100 },
          { account: '1120', credit: 100 },
        ],
      })).status
    ).toBe(400);

    expect(
      (await post('/api/books/journal', {
        description: 'No date',
        lines: [
          { account: '1400', debit: 100 },
          { account: '1120', credit: 100 },
        ],
      })).status
    ).toBe(400);
  });

  it('a posting into a closed month', async () => {
    const periods = await get('/api/books/periods');
    // A month that has not finished cannot be closed, so this has to be one
    // that has — and an empty one, so closing it disturbs nothing.
    const finished = today();
    const month = periods.body.periods.find(
      (p) => p.status === 'open' && p.entryCount === 0 && p.endsOn < finished
    );

    const closed = await post(`/api/books/periods/${month._id}/close`);
    expect(closed.status).toBe(200);

    const res = await post('/api/books/journal', {
      date: month.startsOn,
      description: 'Into a closed month',
      lines: [
        { account: '1400', debit: 100 },
        { account: '1120', credit: 100 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/closed/i);

    await post(`/api/books/periods/${month._id}/reopen`);
  });
});

describe('reversing an entry', () => {
  const anEntry = async (amount = 5000) => {
    const res = await post('/api/books/journal', {
      date: today(),
      description: 'To be undone',
      lines: [
        { account: '1400', debit: amount },
        { account: '1120', credit: amount },
      ],
    });
    return res.body.entry;
  };

  it('mirrors it, and leaves both in the books', async () => {
    const before = await balanceOf('1400');
    const entry = await anEntry(5000);

    expect(await balanceOf('1400')).toBe(before + 5000);

    const res = await post(`/api/books/journal/${entry._id}/reverse`);

    expect(res.status).toBe(201);
    expect(await balanceOf('1400')).toBe(before);

    // The original is untouched — that is the difference between a ledger and a
    // spreadsheet.
    const original = await get(`/api/books/journal/${entry._id}`);
    expect(original.body.entry.lines).toHaveLength(2);
    expect(original.body.entry.reversedById).toBeTruthy();
  });

  it('refuses to reverse the same entry twice', async () => {
    const entry = await anEntry();
    await post(`/api/books/journal/${entry._id}/reverse`);

    const again = await post(`/api/books/journal/${entry._id}/reverse`);

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already reversed/i);
  });

  it('takes a reason, and 404s on an entry that is not there', async () => {
    const entry = await anEntry();
    const res = await post(`/api/books/journal/${entry._id}/reverse`, {
      reason: 'Posted to the wrong account',
    });

    expect(res.body.entry.description).toMatch(/wrong account/i);

    expect(
      (await post('/api/books/journal/00000000-0000-0000-0000-000000000000/reverse')).status
    ).toBe(404);
  });

  it('leaves the books in balance', async () => {
    const entry = await anEntry();
    await post(`/api/books/journal/${entry._id}/reverse`);

    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });
});

describe('who may post by hand', () => {
  // Writing directly into the books is the owner writing into their own books.
  it('needs books.manage, which an admin does not have', async () => {
    const admin = await signInAsOperator('admin');

    const res = await api('post', '/api/books/journal')
      .set('Cookie', admin)
      .send({
        date: today(),
        description: 'Not allowed',
        lines: [
          { account: '1400', debit: 100 },
          { account: '1120', credit: 100 },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.requiredPermissions).toEqual(['books.manage']);
  });

  it('is audited', async () => {
    await post('/api/books/journal', {
      date: today(),
      description: 'Audited',
      lines: [
        { account: '1400', debit: 250 },
        { account: '1120', credit: 250 },
      ],
    });

    const [entry] = await rows(
      `SELECT action::text FROM audit_logs
        WHERE resource_type = 'journal_entry' ORDER BY created_at DESC LIMIT 1`
    );

    expect(entry.action).toBe('CREATE');
  });
});
