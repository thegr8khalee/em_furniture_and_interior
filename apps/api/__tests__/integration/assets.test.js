import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb } from '../helpers/database.js';

// What the business owns and wears out.
//
// A workshop full of tools and a delivery van, none of it in the books. Bought,
// it was recorded as an expense in the month it was bought — which destroys that
// month's profit and flatters every month after, because the van goes on earning
// while nothing charges for its use.
//
// The figures: a van at ₦4,800,000 with a ₦800,000 residual over 40 months, so
// ₦4,000,000 depreciable and exactly ₦100,000 a month.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let ownerCookie;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `11.10.${(callers >> 8) & 255}.${callers++ & 255}`);

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

const aVan = (overrides = {}) =>
  post('/api/assets', {
    name: 'Delivery van',
    acquiredOn: '2026-01-15',
    cost: 4800000,
    residualValue: 800000,
    usefulLifeMonths: 40,
    ...overrides,
  });

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

describe('registering something the business owns', () => {
  it('records what it cost and what it is worth now', async () => {
    const res = await aVan();

    expect(res.status).toBe(201);
    expect(res.body.asset.cost).toBe(4800000);
    expect(res.body.asset.bookValue).toBe(4800000);
    expect(res.body.asset.depreciationToDate).toBe(0);
    // ₦4,000,000 depreciable across 40 months.
    expect(res.body.asset.monthlyCharge).toBe(100000);
  });

  // Capitalising is the whole point: the money left the bank but the value did
  // not leave the business.
  it('moves the money into the asset rather than into an expense', async () => {
    const assets = await balanceOf('1500');
    const bank = await balanceOf('1120');
    const expenses = await balanceOf('5900');

    await aVan({ paidFrom: 'bank_transfer' });

    expect(await balanceOf('1500')).toBe(assets + 4800000);
    expect(await balanceOf('1120')).toBe(bank - 4800000);
    expect(await balanceOf('5900')).toBe(expenses);
  });

  it('can be bought on credit', async () => {
    const payable = await balanceOf('2100');
    await aVan({ paidFrom: 'payable' });

    expect(await balanceOf('2100')).toBe(payable + 4800000);
  });

  // The purchase may already be in the books, through a purchase order or an
  // expense recorded before anyone thought to capitalise it.
  it('posts nothing when the purchase is already recorded elsewhere', async () => {
    const assets = await balanceOf('1500');
    await aVan();

    expect(await balanceOf('1500')).toBe(assets);
  });

  it('refuses a residual worth more than the thing cost', async () => {
    const res = await aVan({ cost: 100000, residualValue: 200000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/less than what it cost/i);
  });

  it('refuses no cost, and a life that is not whole months', async () => {
    expect((await aVan({ cost: 0 })).status).toBe(400);
    expect((await aVan({ usefulLifeMonths: 0 })).status).toBe(400);
    expect((await aVan({ usefulLifeMonths: 2.5 })).status).toBe(400);
  });
});

describe('charging a month', () => {
  it('charges depreciation to profit and to the contra-asset', async () => {
    const asset = (await aVan()).body.asset;

    const expense = await balanceOf('5800');
    const accumulated = await balanceOf('1590');

    const res = await post('/api/assets/depreciation', { month: '2026-02-01' });

    expect(res.status).toBe(200);
    expect(res.body.charged).toBeGreaterThan(0);

    // Against the run's own total rather than one asset's: earlier tests in this
    // suite left other vans on the register, and they are charged too.
    expect(await balanceOf('5800')).toBe(expense + Number(res.body.total));
    // A contra-asset: its balance runs negative, reducing what the business owns.
    expect(await balanceOf('1590')).toBe(accumulated - Number(res.body.total));

    const after = await get(`/api/assets/${asset._id}`);
    expect(after.body.asset.depreciationToDate).toBe(100000);
    expect(after.body.asset.bookValue).toBe(4700000);
  });

  // Re-running a month is the ordinary way to finish one that was interrupted.
  it('charges nothing twice when the month is run again', async () => {
    await aVan();
    await post('/api/assets/depreciation', { month: '2026-03-01' });

    const expense = await balanceOf('5800');
    const again = await post('/api/assets/depreciation', { month: '2026-03-01' });

    expect(again.body.charged).toBe(0);
    expect(again.body.skipped).toBeGreaterThan(0);
    expect(await balanceOf('5800')).toBe(expense);
  });

  it('leaves out something bought after the month being charged', async () => {
    const asset = (await aVan({ acquiredOn: '2026-06-01' })).body.asset;

    await post('/api/assets/depreciation', { month: '2026-04-01' });

    const after = await get(`/api/assets/${asset._id}`);
    expect(after.body.asset.depreciationToDate).toBe(0);
  });

  it('dates the charge to the month it covers, not the day it was run', async () => {
    await aVan();
    await post('/api/assets/depreciation', { month: '2026-05-01' });

    const [entry] = await rows(
      `SELECT entry_date FROM journal_entries
        WHERE source = 'depreciation' ORDER BY created_at DESC LIMIT 1`
    );

    expect(String(entry.entry_date)).toMatch(/2026-05-31/);
  });

  // Otherwise the accumulated total lands a kobo either side of the depreciable
  // amount and stays there for ever.
  it('never charges more than the asset is worth losing', async () => {
    // ₦1,000 over 3 months: 333 + 333 + 334.
    const asset = (await aVan({ cost: 1000, residualValue: 0, usefulLifeMonths: 3 })).body.asset;

    for (const month of ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']) {
      await post('/api/assets/depreciation', { month });
    }

    const after = await get(`/api/assets/${asset._id}`);
    expect(after.body.asset.depreciationToDate).toBe(1000);
    expect(after.body.asset.bookValue).toBe(0);
    expect(after.body.asset.isFullyCharged).toBe(true);
  });

  it('leaves the books in balance', async () => {
    await aVan();
    await post('/api/assets/depreciation', { month: '2026-11-01' });

    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });
});

describe('the register', () => {
  it('totals what is in use, at cost and at book value', async () => {
    const res = await get('/api/assets');

    expect(res.status).toBe(200);
    expect(res.body.totals.cost).toBeGreaterThan(0);
    expect(res.body.totals.bookValue).toBeLessThanOrEqual(res.body.totals.cost);
  });

  it('stops charging something taken out of use', async () => {
    const asset = (await aVan({ acquiredOn: '2026-01-01' })).body.asset;

    const disposed = await post(`/api/assets/${asset._id}/dispose`, {
      disposedOn: '2026-01-31',
      notes: 'Sold',
    });
    expect(disposed.status).toBe(200);

    const before = await get(`/api/assets/${asset._id}`);
    await post('/api/assets/depreciation', { month: '2026-12-01' });
    const after = await get(`/api/assets/${asset._id}`);

    expect(after.body.asset.depreciationToDate).toBe(before.body.asset.depreciationToDate);
  });

  it('refuses to dispose of the same thing twice, or before it was bought', async () => {
    const asset = (await aVan()).body.asset;
    await post(`/api/assets/${asset._id}/dispose`);

    expect((await post(`/api/assets/${asset._id}/dispose`)).status).toBe(400);

    const other = (await aVan({ acquiredOn: '2026-06-01' })).body.asset;
    const early = await post(`/api/assets/${other._id}/dispose`, { disposedOn: '2026-01-01' });
    expect(early.status).toBe(400);
  });

  it('404s for something that is not there', async () => {
    expect((await get('/api/assets/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('who may capitalise', () => {
  // Deciding what counts as an asset rather than an expense changes reported
  // profit, so it sits with the money permissions.
  it('needs books.manage to register or to charge a month', async () => {
    const admin = await signInAsOperator('admin');

    expect(
      (await api('post', '/api/assets').set('Cookie', admin).send({ name: 'No' })).status
    ).toBe(403);
    expect(
      (await api('post', '/api/assets/depreciation').set('Cookie', admin).send({})).status
    ).toBe(403);
  });

  it('lets anyone with finance.view read the register', async () => {
    const res = await get('/api/assets');
    expect(res.status).toBe(200);
  });

  it('keeps the public out entirely', async () => {
    expect((await api('get', '/api/assets')).status).toBe(401);
  });
});
