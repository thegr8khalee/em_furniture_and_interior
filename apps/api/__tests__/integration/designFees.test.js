import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb } from '../helpers/database.js';

// Billing the design work.
//
// `4200 Interior design fees` sat in the chart unreachable: consultations ran
// from enquiry to completion and stopped, so the design half of the business
// earned nothing and every revenue figure described the furniture only.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;

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

/** An enquiry, as the storefront submits one. */
async function aConsultation() {
  const res = await api('post', '/api/consultations')
    .set('Cookie', [`anonymousId=anon-${Math.random().toString(36).slice(2)}`])
    .send({
      fullName: 'Ada Obi',
      email: `ada-${Math.random().toString(36).slice(2)}@example.com`,
      phone: '08030000000',
      budgetMin: 500000,
      budgetMax: 2000000,
      preferredMeetingType: 'calendly',
      notes: 'A sitting room and a study',
    });

  return res.body.consultation;
}

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('an enquiry that has not been billed', () => {
  it('owes nothing and has no fee', async () => {
    const consultation = await aConsultation();

    expect(consultation.fee.total).toBe(0);
    expect(consultation.fee.billedAt).toBeNull();
  });

  // Most consultations stay in this state. An enquiry that went nowhere is not
  // a debt, and posting one would invent revenue.
  it('posts nothing to the ledger', async () => {
    const fees = await balanceOf('4200');
    await aConsultation();

    expect(await balanceOf('4200')).toBe(fees);
  });
});

describe('billing the design work', () => {
  it('earns the fee and raises what is owed', async () => {
    const fees = await balanceOf('4200');
    const receivable = await balanceOf('1200');

    const consultation = await aConsultation();
    const res = await post(`/api/consultations/admin/${consultation._id}/bill`, {
      amount: 150000,
    });

    expect(res.status).toBe(200);
    expect(res.body.consultation.fee.total).toBe(150000);
    expect(res.body.consultation.fee.billedAt).toBeTruthy();

    expect(await balanceOf('4200')).toBe(fees + 150000);
    expect(await balanceOf('1200')).toBe(receivable + 150000);
  });

  it('separates VAT from the fee', async () => {
    const fees = await balanceOf('4200');
    const vat = await balanceOf('2200');
    const receivable = await balanceOf('1200');

    const consultation = await aConsultation();
    await post(`/api/consultations/admin/${consultation._id}/bill`, {
      amount: 200000,
      tax: 15000,
    });

    expect(await balanceOf('4200')).toBe(fees + 200000);
    expect(await balanceOf('2200')).toBe(vat + 15000);
    expect(await balanceOf('1200')).toBe(receivable + 215000);
  });

  it('writes one entry, sourced to the consultation', async () => {
    const consultation = await aConsultation();
    await post(`/api/consultations/admin/${consultation._id}/bill`, { amount: 90000 });

    const entries = await rows(
      `SELECT id FROM journal_entries WHERE source = 'design_fee' AND source_id = :id`,
      { id: consultation._id }
    );

    expect(entries).toHaveLength(1);
  });

  // The way to change a figure that is already in the books is a credit note,
  // not a second bill for the same work.
  it('refuses to bill the same work twice', async () => {
    const consultation = await aConsultation();
    await post(`/api/consultations/admin/${consultation._id}/bill`, { amount: 90000 });

    const again = await post(`/api/consultations/admin/${consultation._id}/bill`, {
      amount: 90000,
    });

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already been billed/i);
  });

  it('refuses a zero or negative fee', async () => {
    const consultation = await aConsultation();

    expect((await post(`/api/consultations/admin/${consultation._id}/bill`, { amount: 0 })).status)
      .toBe(400);
    expect((await post(`/api/consultations/admin/${consultation._id}/bill`, { amount: -5 })).status)
      .toBe(400);
  });

  it('404s for a consultation that is not there', async () => {
    const res = await post(
      '/api/consultations/admin/00000000-0000-0000-0000-000000000000/bill',
      { amount: 1000 }
    );
    expect(res.status).toBe(404);
  });
});

describe('settling a design fee', () => {
  const billed = async (amount = 150000) => {
    const consultation = await aConsultation();
    await post(`/api/consultations/admin/${consultation._id}/bill`, { amount });
    return consultation;
  };

  it('clears what was owed and puts the money in the bank', async () => {
    const consultation = await billed();
    const receivable = await balanceOf('1200');
    const bank = await balanceOf('1120');

    const res = await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'bank_transfer',
    });

    expect(res.status).toBe(200);
    expect(res.body.consultation.fee.paidOn).toBeTruthy();
    expect(await balanceOf('1200')).toBe(receivable - 150000);
    expect(await balanceOf('1120')).toBe(bank + 150000);
  });

  it('refuses to settle work that was never billed', async () => {
    const consultation = await aConsultation();
    const res = await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'bank_transfer',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not been billed/i);
  });

  it('refuses to settle twice, and refuses a method that is not one', async () => {
    const consultation = await billed();
    await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'bank_transfer',
    });

    const again = await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'bank_transfer',
    });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already paid/i);

    const other = await billed();
    expect(
      (await post(`/api/consultations/admin/${other._id}/fee-payment`, { paymentMethod: 'goat' }))
        .status
    ).toBe(400);
  });

  it('leaves the books in balance', async () => {
    const consultation = await billed(75000);
    await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'cash_on_delivery',
    });

    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });

  it('shows up as revenue on the profit and loss', async () => {
    const consultation = await billed(120000);
    await post(`/api/consultations/admin/${consultation._id}/fee-payment`, {
      paymentMethod: 'bank_transfer',
    });

    const year = new Date().getFullYear();
    const res = await get(
      `/api/books/reports/profit-and-loss?from=${year}-01-01&to=${year}-12-31`
    );

    expect(res.body.revenue.lines.some((line) => line.code === '4200')).toBe(true);
  });
});

describe('who may bill', () => {
  it('needs finance.view — it is the owner who decides money is owed', async () => {
    const editor = await signInAsOperator('editor');
    const consultation = await aConsultation();

    const res = await api('post', `/api/consultations/admin/${consultation._id}/bill`)
      .set('Cookie', editor)
      .send({ amount: 1000 });

    expect(res.status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    const consultation = await aConsultation();
    const res = await api('post', `/api/consultations/admin/${consultation._id}/bill`).send({
      amount: 1000,
    });

    expect(res.status).toBe(401);
  });
});
