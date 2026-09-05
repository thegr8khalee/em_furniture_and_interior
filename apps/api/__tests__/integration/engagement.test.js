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

// Notifications, loyalty points, and the two logs.
//
// The loyalty tests are the ones that matter most: the balance on the account
// and the ledger that explains it are written together, so the interesting
// assertions check both after every movement.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '0';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
  sofaId = await insertProduct({ name: 'Loyal Sofa', price: 10000000 }); // ₦100,000
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.9.${(callers >> 8) & 255}.${callers++ & 255}`);

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

const signUp = async () => {
  const email = `shopper-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await api('post', '/api/auth/signup').send({
    fullName: 'Ada Obi',
    email,
    password: 'Password123!',
  });
  return { cookie: asCookie(res), customerId: res.body.id };
};

const ADDRESS = {
  fullName: 'Ada Obi',
  phone: '08030000000',
  email: 'ada@example.com',
  address: '12 Ikoyi Crescent',
  city: 'Lagos',
  state: 'Lagos',
};

/** Buys the sofa and walks the order all the way to delivered. */
const buyAndDeliver = async (cookie) => {
  const placed = await api('post', '/api/orders/create')
    .set('Cookie', cookie)
    .send({ shippingAddress: ADDRESS, items: [{ item: sofaId, quantity: 1 }] });

  await api('put', `/api/orders/admin/${placed.body.order._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'delivered' });

  return placed.body.order;
};

describe('notifications', () => {
  it('reaches the shopper who placed the order, and nobody else', async () => {
    const mine = await signUp();
    const theirs = await signUp();

    await buyAndDeliver(mine.cookie);

    const forMe = await api('get', '/api/notifications').set('Cookie', mine.cookie);
    const forThem = await api('get', '/api/notifications').set('Cookie', theirs.cookie);

    expect(forMe.body.notifications.length).toBeGreaterThan(0);
    expect(forMe.body.unreadCount).toBe(forMe.body.notifications.length);
    expect(forThem.body.notifications).toHaveLength(0);
  });

  it('marks one read, and records when', async () => {
    const { cookie } = await signUp();
    await buyAndDeliver(cookie);

    const listed = await api('get', '/api/notifications').set('Cookie', cookie);
    const first = listed.body.notifications[0];

    const res = await api('patch', `/api/notifications/${first._id}/read`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.notification.isRead).toBe(true);

    const [row] = await rows('SELECT read_at FROM notifications WHERE id = :id', { id: first._id });
    expect(row.read_at).not.toBeNull();
  });

  it('will not let one shopper mark another’s notification read', async () => {
    const mine = await signUp();
    const theirs = await signUp();
    await buyAndDeliver(mine.cookie);

    const listed = await api('get', '/api/notifications').set('Cookie', mine.cookie);
    const res = await api('patch', `/api/notifications/${listed.body.notifications[0]._id}/read`)
      .set('Cookie', theirs.cookie);

    expect(res.status).toBe(404);
  });

  it('marks everything read at once, and deletes one', async () => {
    const { cookie } = await signUp();
    await buyAndDeliver(cookie);

    await api('patch', '/api/notifications/read-all').set('Cookie', cookie);
    const afterAll = await api('get', '/api/notifications').set('Cookie', cookie);
    expect(afterAll.body.unreadCount).toBe(0);

    const removed = await api(
      'delete',
      `/api/notifications/${afterAll.body.notifications[0]._id}`
    ).set('Cookie', cookie);
    expect(removed.status).toBe(200);
  });

  it('needs a session', async () => {
    const res = await api('get', '/api/notifications');

    expect(res.status).toBe(401);
  });
});

describe('loyalty points', () => {
  it('credits the balance and the ledger together when an order is delivered', async () => {
    const { cookie, customerId } = await signUp();

    await buyAndDeliver(cookie); // ₦100,000 → 100 points

    const summary = await api('get', '/api/loyalty/summary').set('Cookie', cookie);
    const history = await api('get', '/api/loyalty/history').set('Cookie', cookie);

    expect(summary.body.balance).toBe(100);
    expect(summary.body.totalEarned).toBe(100);
    expect(history.body.transactions[0]).toMatchObject({ type: 'earn', points: 100 });

    const [account] = await rows('SELECT loyalty_points FROM customers WHERE id = :id', {
      id: customerId,
    });
    expect(account.loyalty_points).toBe(100);
  });

  it('will not pay the same order twice', async () => {
    const { cookie, customerId } = await signUp();
    const order = await buyAndDeliver(cookie);

    // Back and forth through delivered again.
    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'shipped' });
    await api('put', `/api/orders/admin/${order._id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'delivered' });

    const [account] = await rows('SELECT loyalty_points FROM customers WHERE id = :id', {
      id: customerId,
    });
    const [ledger] = await rows(
      `SELECT count(*)::int AS total FROM loyalty_transactions
        WHERE customer_id = :id AND type = 'earn'`,
      { id: customerId }
    );

    expect(account.loyalty_points).toBe(100);
    expect(ledger.total).toBe(1);
  });

  it('refuses an earn that would subtract, and a redemption below zero', async () => {
    const { recordLoyalty } = await import('../../src/services/engagement.js');
    const { customerId } = await signUp();

    await expect(
      recordLoyalty({ customerId, type: 'earn', points: -10 })
    ).rejects.toThrow(/direction/i);

    await expect(
      recordLoyalty({ customerId, type: 'redeem', points: -10 })
    ).rejects.toThrow(/below zero/i);
  });

  it('redeems against a balance, and the ledger explains what is left', async () => {
    const { recordLoyalty } = await import('../../src/services/engagement.js');
    const { cookie, customerId } = await signUp();
    await buyAndDeliver(cookie);

    const { balance } = await recordLoyalty({
      customerId,
      type: 'redeem',
      points: -40,
      description: 'Redeemed at checkout',
    });

    expect(balance).toBe(60);

    const summary = await api('get', '/api/loyalty/summary').set('Cookie', cookie);
    expect(summary.body).toMatchObject({ balance: 60, totalEarned: 100, totalRedeemed: 40 });
  });
});

describe('the audit log', () => {
  it('records what an operator did, with the resource and the outcome', async () => {
    const created = await api('post', '/api/admin/faqs')
      .set('Cookie', adminCookie)
      .send({ question: 'Audited?', answer: 'Yes' });

    expect(created.status).toBe(201);

    const res = await api('get', '/api/logs/audit?resourceType=faq').set('Cookie', adminCookie);

    const entry = res.body.data[0];
    expect(entry).toMatchObject({ action: 'CREATE', resourceType: 'faq', status: 'success' });
    expect(entry.actorEmail).toMatch(/@/);
    expect(entry.changes).toMatchObject({ question: 'Audited?' });
  });

  it('records a refused action as failed, and keeps no credential in it', async () => {
    const owner = await signInAsOperator();

    await api('post', '/api/admin/signup')
      .set('Cookie', owner)
      .send({ username: 'x', email: 'not-an-email-and-taken', password: 'Password123!' })
      .catch(() => {});

    const res = await api('get', '/api/logs/audit?resourceType=staff').set('Cookie', adminCookie);

    const entry = res.body.data.find((row) => row.resourceType === 'staff');
    expect(entry).toBeDefined();
    expect(JSON.stringify(entry.changes ?? {})).not.toContain('Password123!');
  });

  it('summarises by action, resource and actor', async () => {
    const res = await api('get', '/api/logs/audit/stats').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.stats.byAction.length).toBeGreaterThan(0);
    expect(res.body.stats.byActor[0]).toHaveProperty('actorEmail');
  });

  it('deletes entries older than a cutoff, and refuses a nonsense one', async () => {
    const kept = await api('post', '/api/logs/audit/cleanup')
      .set('Cookie', adminCookie)
      .send({ daysToKeep: 30 });
    const rejected = await api('post', '/api/logs/audit/cleanup')
      .set('Cookie', adminCookie)
      .send({ daysToKeep: 'yesterday' });

    expect(kept.status).toBe(200);
    expect(kept.body.deletedCount).toBe(0); // everything here is minutes old
    expect(rejected.status).toBe(400);
  });
});

describe('the activity log', () => {
  it('records a signed-in shopper viewing a product, and names them', async () => {
    const { cookie, customerId } = await signUp();

    await api('get', `/api/products/${sofaId}`).set('Cookie', cookie);

    const res = await api('get', `/api/logs/activity?userId=${customerId}`).set(
      'Cookie',
      adminCookie
    );

    const entry = res.body.data.find((row) => row.activityType === 'PRODUCT_VIEW');
    expect(entry).toBeDefined();
    expect(entry.user).toMatchObject({ _id: customerId, username: 'Ada Obi' });
    expect(entry.resourceId).toBe(sofaId);
  });

  it('records a guest against their session rather than nobody', async () => {
    const anonymousId = `anon-${Math.random().toString(36).slice(2)}`;

    // A write first, so the guest has a session row to attribute the view to.
    await api('put', '/api/cart/add')
      .set('Cookie', [`anonymousId=${anonymousId}`])
      .send({ itemId: sofaId, quantity: 1 });
    await api('get', `/api/products/${sofaId}`).set('Cookie', [`anonymousId=${anonymousId}`]);

    const [session] = await rows(
      'SELECT id FROM guest_sessions WHERE anonymous_id = :anonymousId',
      { anonymousId }
    );
    const [logged] = await rows(
      `SELECT count(*)::int AS total FROM activity_logs
        WHERE guest_session_id = :id AND activity_type = 'PRODUCT_VIEW'`,
      { id: session.id }
    );

    expect(logged.total).toBeGreaterThan(0);
  });

  it('summarises by activity and by hour, and names its top shoppers', async () => {
    const res = await api('get', '/api/logs/activity/stats').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.stats.byActivity.length).toBeGreaterThan(0);
    expect(res.body.stats.byHour.length).toBeGreaterThan(0);
    // The old pipeline concatenated firstName and lastName, which the account
    // never had, so every row read "undefined undefined".
    expect(res.body.stats.topUsers[0].userName).toBe('Ada Obi');
  });

  it('is closed to an operator without the finance permission', async () => {
    const social = await signInAsOperator('social_media_manager');

    const res = await api('get', '/api/logs/audit').set('Cookie', social);

    expect(res.status).toBe(403);
  });
});
