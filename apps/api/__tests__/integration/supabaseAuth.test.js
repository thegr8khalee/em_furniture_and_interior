import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb, currentDatabaseUrl } from '../helpers/database.js';

// Signing in through Supabase Auth.
//
// Supabase itself is stubbed at `fetch`, which is exactly the boundary the
// service treats as authoritative: it asks `/auth/v1/user` who a token belongs
// to and believes the answer. What is under test is everything on this side of
// that answer — which account it resolves to, which it refuses to create, and
// that the session it issues is the ordinary one.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let realFetch;

// What the stubbed Supabase will say next.
let supabaseReply = null;

const authUser = (overrides = {}) => ({
  id: overrides.id ?? '11111111-1111-1111-1111-111111111111',
  email: overrides.email ?? 'ada@example.com',
  user_metadata: { full_name: overrides.name ?? 'Ada Obi', ...(overrides.metadata ?? {}) },
});

const willAccept = (user) => {
  supabaseReply = { ok: true, json: async () => user };
};

const willReject = () => {
  supabaseReply = { ok: false, status: 401, json: async () => ({ message: 'invalid' }) };
};

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.30.${(callers >> 8) & 255}.${callers++ & 255}`);

const cookieFrom = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  ({ default: app } = await import('../../src/app.js'));

  realFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async (url, options) => {
    // Only Supabase Auth is stubbed; anything else in the process keeps its
    // real fetch, so a stray network call here is loud rather than silent.
    if (!`${url}`.includes('/auth/v1/user')) return realFetch(url, options);
    if (supabaseReply instanceof Error) throw supabaseReply;
    return supabaseReply;
  });
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  await closeSequelize();
  await teardownDatabase();
});

beforeEach(() => {
  willReject();
});

describe('a shopper signing in with Supabase', () => {
  it('creates the account on first sign-in, with no local password', async () => {
    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000001', email: 'new@example.com' }));

    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@example.com');
    expect(res.body.username).toBe('Ada Obi');

    const [row] = await rows(
      'SELECT password_hash, supabase_user_id FROM customers WHERE email = :email',
      { email: 'new@example.com' }
    );

    // The account is reachable by the Supabase identity alone, which is what
    // `customers_has_credential` allows and nothing had ever used.
    expect(row.password_hash).toBeNull();
    expect(row.supabase_user_id).toBe('a0000000-0000-0000-0000-000000000001');
  });

  it('issues the ordinary session cookie', async () => {
    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000002', email: 'cookie@example.com' }));

    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });
    const checked = await api('get', '/api/auth/check').set('Cookie', cookieFrom(res));

    // Nothing downstream knows which door they came through.
    expect(checked.status).toBe(200);
    expect(checked.body.email).toBe('cookie@example.com');
  });

  it('signs the same identity back in without creating a second account', async () => {
    const user = authUser({ id: 'a0000000-0000-0000-0000-000000000003', email: 'again@example.com' });

    willAccept(user);
    const first = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });
    willAccept(user);
    const second = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);

    const found = await rows('SELECT id FROM customers WHERE email = :email', {
      email: 'again@example.com',
    });
    expect(found).toHaveLength(1);
  });

  // A shopper who signs up with Google using the address they already ordered
  // under is the same person. A second row would split their orders and their
  // loyalty points across two accounts they cannot see.
  it('adopts an existing password account with the same email', async () => {
    const { registerCustomer } = await import('../../src/services/identity.js');
    const existing = await registerCustomer({
      fullName: 'Old Account',
      email: 'both@example.com',
      password: 'Password123!',
    });
    await getDb().query('UPDATE customers SET loyalty_points = 250 WHERE id = :id', {
      replacements: { id: existing.id },
    });

    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000004', email: 'both@example.com' }));
    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(existing.id);
    expect(res.body.loyaltyPoints).toBe(250);
  });

  it('leaves the password path working for an adopted account', async () => {
    const { registerCustomer } = await import('../../src/services/identity.js');
    await registerCustomer({
      fullName: 'Still Has A Password',
      email: 'keeps@example.com',
      password: 'Password123!',
    });

    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000005', email: 'keeps@example.com' }));
    await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    const res = await api('post', '/api/auth/login').send({
      email: 'keeps@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
  });

  // Two providers, one address. Silently relinking would hand the account to
  // whoever signed up second.
  it('refuses an email already linked to a different identity', async () => {
    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000006', email: 'taken@example.com' }));
    await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000007', email: 'taken@example.com' }));
    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(409);
  });

  it('falls back to the local part of the email when Supabase carries no name', async () => {
    willAccept({
      id: 'a0000000-0000-0000-0000-000000000008',
      email: 'nameless@example.com',
      user_metadata: {},
    });

    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.body.username).toBe('nameless');
  });
});

describe('a token Supabase will not vouch for', () => {
  it('is refused', async () => {
    willReject();
    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'forged' });

    expect(res.status).toBe(401);
  });

  it('is refused when it is missing altogether', async () => {
    const res = await api('post', '/api/auth/supabase').send({});
    expect(res.status).toBe(401);
  });

  // Supabase being unreachable is our problem, not the caller's: a 401 would
  // tell them their credentials are wrong when they are not.
  it('is a 503 when Supabase cannot be reached', async () => {
    supabaseReply = new Error('ECONNREFUSED');
    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(503);
  });

  it('is refused when the reply carries no email', async () => {
    supabaseReply = { ok: true, json: async () => ({ id: 'no-email' }) };
    const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(401);
  });

  it('accepts the token from an Authorization header too', async () => {
    willAccept(authUser({ id: 'a0000000-0000-0000-0000-000000000009', email: 'header@example.com' }));

    const res = await api('post', '/api/auth/supabase')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(201);
  });
});

describe('an operator signing in with Supabase', () => {
  const staffAccount = async (overrides = {}) => {
    const { registerStaff } = await import('../../src/services/identity.js');
    const suffix = Math.random().toString(36).slice(2);
    return registerStaff({
      username: `ops-${suffix}`,
      email: overrides.email ?? `ops-${suffix}@example.com`,
      password: 'Password123!',
      role: overrides.role ?? 'super_admin',
    });
  };

  it('links the identity to an operator that already exists', async () => {
    const staff = await staffAccount();
    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000001', email: staff.email }));

    const res = await api('post', '/api/admin/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(staff.id);
    expect(res.body.role).toBe('admin');
    expect(res.body.adminRole).toBe('super_admin');

    // And the session works on a console route, which is the point of it.
    const books = await api('get', '/api/books/trial-balance').set('Cookie', cookieFrom(res));
    expect(books.status).toBe(200);
  });

  // Anyone who can sign up to the Supabase project would otherwise become
  // staff. An operator is created by bootstrap:staff or by someone holding
  // staff.manage, and only then can they sign in this way.
  it('never creates one', async () => {
    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000002', email: 'stranger@example.com' }));

    const res = await api('post', '/api/admin/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(403);
    expect(await rows('SELECT id FROM staff WHERE email = :email', { email: 'stranger@example.com' }))
      .toHaveLength(0);
  });

  it('keeps a deactivated operator out, and says so', async () => {
    const staff = await staffAccount();
    await getDb().query('UPDATE staff SET is_active = false WHERE id = :id', {
      replacements: { id: staff.id },
    });

    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000003', email: staff.email }));
    const res = await api('post', '/api/admin/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('records the sign-in', async () => {
    const staff = await staffAccount();
    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000004', email: staff.email }));
    await api('post', '/api/admin/supabase').send({ accessToken: 'token' });

    const [row] = await rows(
      'SELECT last_login_at, supabase_user_id FROM staff WHERE id = :id',
      { id: staff.id }
    );

    expect(row.last_login_at).not.toBeNull();
    expect(row.supabase_user_id).toBe('b0000000-0000-0000-0000-000000000004');
  });

  it('does not let a shopper token through the console door', async () => {
    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000005', email: 'shopper@example.com' }));
    await api('post', '/api/auth/supabase').send({ accessToken: 'token' });

    willAccept(authUser({ id: 'b0000000-0000-0000-0000-000000000005', email: 'shopper@example.com' }));
    const res = await api('post', '/api/admin/supabase').send({ accessToken: 'token' });

    expect(res.status).toBe(403);
  });
});

describe('an installation with no Supabase configured', () => {
  it('says so rather than failing obscurely', async () => {
    const url = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    try {
      const res = await api('post', '/api/auth/supabase').send({ accessToken: 'token' });
      expect(res.status).toBe(503);
    } finally {
      process.env.SUPABASE_URL = url;
    }
  });
});
