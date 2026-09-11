import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb } from '../helpers/database.js';

// Paying the people who make the furniture.
//
// Salaries could only be recorded as an expense — a lump sum with a description
// and nothing behind it. The reason this is more than an expense is the money
// that is deducted and not yet handed over: tax withheld belongs to FIRS and
// pension contributions belong to the fund, and until they are remitted they are
// debts sitting in the bank looking like money the business can spend.
//
// The figures: ₦300,000 a month, 10% PAYE, 8% employee pension, 10% employer.
// So ₦30,000 tax, ₦24,000 from them, ₦30,000 from the business, ₦246,000 net.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let ownerCookie;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `11.20.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', ownerCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', ownerCookie).send(body);
const del = (path) => api('delete', path).set('Cookie', ownerCookie);

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

const hire = (overrides = {}) =>
  post('/api/payroll/employees', {
    fullName: `Cabinetmaker ${Math.random().toString(36).slice(2, 7)}`,
    jobTitle: 'Cabinetmaker',
    monthlySalary: 300000,
    payeRate: 10,
    pensionRate: 8,
    employerPensionRate: 10,
    startedOn: '2026-01-01',
    ...overrides,
  });

/**
 * A month nobody else in this suite has used.
 *
 * Rolls into the following years rather than counting past December: one pay run
 * per month is a unique index, so every test needs its own, and there are more
 * tests than there are months in a year.
 */
let monthsUsed = 0;
const aMonth = () => {
  const offset = monthsUsed++;
  const year = 2026 + Math.floor(offset / 12);
  const month = (offset % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
};

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

describe('the people on the payroll', () => {
  it('records what they earn and what comes off it', async () => {
    const res = await hire({ fullName: 'Ada the Cabinetmaker' });

    expect(res.status).toBe(201);
    expect(res.body.employee.monthlySalary).toBe(300000);
    expect(res.body.employee.payeRate).toBe(10);
    expect(res.body.employee.isCurrent).toBe(true);
  });

  it('totals the monthly wage bill', async () => {
    const res = await get('/api/payroll/employees');

    expect(res.body.totals.headcount).toBeGreaterThan(0);
    expect(res.body.totals.monthlyPayroll).toBeGreaterThan(0);
  });

  it('refuses a rate that is not a percentage, and a leaving date before the start', async () => {
    expect((await hire({ payeRate: 150 })).status).toBe(400);

    const employee = (await hire()).body.employee;
    const res = await api('patch', `/api/payroll/employees/${employee._id}`)
      .set('Cookie', ownerCookie)
      .send({ endedOn: '2025-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/before they started/i);
  });
});

describe('building a month', () => {
  it('picks up everyone employed in it and works out each payslip', async () => {
    await hire({ fullName: 'Built For' });
    const month = aMonth();

    const res = await post('/api/payroll/runs', { month });

    expect(res.status).toBe(201);
    expect(res.body.payRun.status).toBe('draft');
    expect(res.body.payRun.headcount).toBeGreaterThan(0);

    const slip = res.body.payRun.payslips.find((p) => p.employee.fullName === 'Built For');
    expect(slip.gross).toBe(300000);
    expect(slip.paye).toBe(30000);
    expect(slip.pension).toBe(24000);
    expect(slip.employerPension).toBe(30000);
    expect(slip.net).toBe(246000);
  });

  // What the month costs the business is the wage plus the employer's own
  // contribution, which is on top of the wage rather than out of it.
  it('separates what the staff receive from what the month costs', async () => {
    await hire();
    const res = await post('/api/payroll/runs', { month: aMonth() });
    const { totals } = res.body.payRun;

    expect(Number(totals.cost)).toBe(Number(totals.gross) + Number(totals.employerPension));
    expect(Number(totals.net)).toBeLessThan(Number(totals.gross));
  });

  it('refuses a second run for the same month', async () => {
    const month = aMonth();
    await post('/api/payroll/runs', { month });

    const again = await post('/api/payroll/runs', { month });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already has a pay run/i);
  });

  it('leaves out somebody who had not started', async () => {
    const late = (await hire({ fullName: 'Started Later', startedOn: '2026-11-01' })).body.employee;

    const res = await post('/api/payroll/runs', { month: aMonth() });

    expect(res.body.payRun.payslips.some((p) => p.employee._id === late._id)).toBe(false);
  });

  // Somebody who left mid-month is still owed for the part they worked, and
  // leaving them out is how a final salary goes unpaid.
  it('includes somebody who left partway through the month', async () => {
    const month = aMonth();
    const leaver = (await hire({ fullName: 'Left Midway' })).body.employee;

    await api('patch', `/api/payroll/employees/${leaver._id}`)
      .set('Cookie', ownerCookie)
      .send({ endedOn: month.replace('-01', '-15') });

    const res = await post('/api/payroll/runs', { month });
    expect(res.body.payRun.payslips.some((p) => p.employee._id === leaver._id)).toBe(true);
  });

  it('discards a draft', async () => {
    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    expect((await del(`/api/payroll/runs/${run._id}`)).status).toBe(200);
  });
});

describe('approving a month', () => {
  const approved = async () => {
    await hire();
    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    await post(`/api/payroll/runs/${run._id}/approve`);
    return (await get(`/api/payroll/runs/${run._id}`)).body.payRun;
  };

  it('creates three debts at once: staff, tax and pension', async () => {
    await hire();
    const wages = await balanceOf('2450');
    const paye = await balanceOf('2500');
    const pension = await balanceOf('2600');
    const expense = await balanceOf('5500');

    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    const res = await post(`/api/payroll/runs/${run._id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.payRun.status).toBe('approved');

    const { totals } = res.body.payRun;

    expect(await balanceOf('2450')).toBe(wages + Number(totals.net));
    expect(await balanceOf('2500')).toBe(paye + Number(totals.paye));
    expect(await balanceOf('2600')).toBe(
      pension + Number(totals.pension) + Number(totals.employerPension)
    );
    // The wage and the employer's pension are both costs of employing someone.
    expect(await balanceOf('5500')).toBe(expense + Number(totals.cost));
  });

  it('dates the entry to the month it pays for, not the day it was approved', async () => {
    await hire();
    const month = aMonth();
    const run = (await post('/api/payroll/runs', { month })).body.payRun;
    await post(`/api/payroll/runs/${run._id}/approve`);

    const [entry] = await rows(
      `SELECT entry_date FROM journal_entries
        WHERE source = 'payroll' AND source_id = :id`,
      { id: run._id }
    );

    // The last day of that month.
    expect(String(entry.entry_date).slice(0, 7)).toBe(month.slice(0, 7));
  });

  it('refuses to approve twice, and refuses to discard once approved', async () => {
    const run = await approved();

    expect((await post(`/api/payroll/runs/${run._id}/approve`)).status).toBe(400);

    const discarded = await del(`/api/payroll/runs/${run._id}`);
    expect(discarded.status).toBe(400);
    expect(discarded.body.message).toMatch(/reverse its journal entry/i);
  });

  it('leaves the books in balance', async () => {
    await approved();
    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });
});

describe('paying a month', () => {
  const approved = async () => {
    await hire();
    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    await post(`/api/payroll/runs/${run._id}/approve`);
    return (await get(`/api/payroll/runs/${run._id}`)).body.payRun;
  };

  it('pays the net and clears what was owed to the staff', async () => {
    const run = await approved();
    const wages = await balanceOf('2450');
    const bank = await balanceOf('1120');

    const res = await post(`/api/payroll/runs/${run._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    expect(res.status).toBe(200);
    expect(await balanceOf('2450')).toBe(wages - Number(run.totals.net));
    expect(await balanceOf('1120')).toBe(bank - Number(run.totals.net));
  });

  // The whole reason payroll is not an expense: this money is still owed to
  // somebody else after the staff have been paid.
  it('leaves the tax and the pension still owed', async () => {
    const run = await approved();
    const paye = await balanceOf('2500');
    const pension = await balanceOf('2600');

    await post(`/api/payroll/runs/${run._id}/pay`, { paymentMethod: 'bank_transfer' });

    expect(await balanceOf('2500')).toBe(paye);
    expect(await balanceOf('2600')).toBe(pension);
  });

  it('refuses to pay a draft, to pay twice, and an unknown method', async () => {
    await hire();
    const draft = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    const onDraft = await post(`/api/payroll/runs/${draft._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });
    expect(onDraft.status).toBe(400);
    expect(onDraft.body.message).toMatch(/approved run/i);

    const run = await approved();
    await post(`/api/payroll/runs/${run._id}/pay`, { paymentMethod: 'bank_transfer' });
    expect(
      (await post(`/api/payroll/runs/${run._id}/pay`, { paymentMethod: 'bank_transfer' })).status
    ).toBe(400);

    const other = await approved();
    expect((await post(`/api/payroll/runs/${other._id}/pay`, { paymentMethod: 'goat' })).status)
      .toBe(400);
  });
});

describe('a payslip is a record', () => {
  // A rise next month must not rewrite what somebody was paid last month.
  it('keeps saying what it said when the salary changes', async () => {
    const employee = (await hire({ fullName: 'Got A Rise' })).body.employee;
    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;

    await api('patch', `/api/payroll/employees/${employee._id}`)
      .set('Cookie', ownerCookie)
      .send({ monthlySalary: 500000 });

    const after = await get(`/api/payroll/runs/${run._id}`);
    const slip = after.body.payRun.payslips.find((p) => p.employee._id === employee._id);

    expect(slip.gross).toBe(300000);
  });

  it('holds the arithmetic on every row', async () => {
    await expect(
      getDb().query(
        `INSERT INTO payslips (pay_run_id, employee_id, gross, paye, pension, net)
         SELECT r.id, e.id, 1000, 100, 100, 900 FROM pay_runs r, employees e LIMIT 1`
      )
    ).rejects.toThrow(/payslip_net_is_gross_less_deductions/);
  });

  it('generates a printable payslip PDF for an employee', async () => {
    const employee = (await hire({ fullName: 'Printable Staff' })).body.employee;
    const run = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;
    const fullRun = (await get(`/api/payroll/runs/${run._id}`)).body.payRun;
    const slip = fullRun.payslips.find((p) => p.employee._id === employee._id);

    const res = await get(`/api/payroll/runs/${run._id}/payslips/${slip._id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('pdf');
  });
});

describe('statutory remittances', () => {
  const approvedRun = async () => {
    const month = aMonth();
    await hire();
    const run = (await post('/api/payroll/runs', { month })).body.payRun;
    await post(`/api/payroll/runs/${run._id}/approve`);
    return (await get(`/api/payroll/runs/${run._id}`)).body.payRun;
  };

  it('remits PAYE tax and clears liability 2500 against bank', async () => {
    const run = await approvedRun();

    const taxBefore = await balanceOf('2500');
    expect(taxBefore).toBeGreaterThan(0);
    const bankBefore = await balanceOf('1120');

    const res = await post(`/api/payroll/runs/${run._id}/remit-tax`, {
      paymentMethod: 'bank_transfer',
      paidOn: '2026-02-10',
    });

    expect(res.status).toBe(200);
    expect(res.body.payRun.taxRemittedAt).toBeTruthy();
    expect(await balanceOf('2500')).toBe(taxBefore - Number(run.totals.paye));
    expect(await balanceOf('1120')).toBe(bankBefore - Number(run.totals.paye));

    // Settle again should fail (idempotency guard)
    const second = await post(`/api/payroll/runs/${run._id}/remit-tax`, {
      paymentMethod: 'bank_transfer',
    });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already been remitted/i);
  });

  it('remits pension contributions and clears liability 2600 against bank', async () => {
    const run = await approvedRun();

    const pensionBefore = await balanceOf('2600');
    expect(pensionBefore).toBeGreaterThan(0);
    const bankBefore = await balanceOf('1120');
    const totalPension = Number(run.totals.pension) + Number(run.totals.employerPension);

    const res = await post(`/api/payroll/runs/${run._id}/remit-pension`, {
      paymentMethod: 'bank_transfer',
      paidOn: '2026-02-10',
    });

    expect(res.status).toBe(200);
    expect(res.body.payRun.pensionRemittedAt).toBeTruthy();
    expect(await balanceOf('2600')).toBe(pensionBefore - totalPension);
    expect(await balanceOf('1120')).toBe(bankBefore - totalPension);

    // Settle again should fail (idempotency guard)
    const second = await post(`/api/payroll/runs/${run._id}/remit-pension`, {
      paymentMethod: 'bank_transfer',
    });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already been remitted/i);
  });

  it('refuses to remit tax or pension on a draft run', async () => {
    const draft = (await post('/api/payroll/runs', { month: aMonth() })).body.payRun;

    const taxRes = await post(`/api/payroll/runs/${draft._id}/remit-tax`);
    expect(taxRes.status).toBe(400);

    const pensionRes = await post(`/api/payroll/runs/${draft._id}/remit-pension`);
    expect(pensionRes.status).toBe(400);
  });
});

describe('who may run payroll', () => {
  // What people are paid is the most sensitive figure in the business.
  it('needs books.manage — an admin cannot see it', async () => {
    const admin = await signInAsOperator('admin');

    expect((await api('get', '/api/payroll/employees').set('Cookie', admin)).status).toBe(403);
    expect((await api('get', '/api/payroll/runs').set('Cookie', admin)).status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    expect((await api('get', '/api/payroll/employees')).status).toBe(401);
  });
});
