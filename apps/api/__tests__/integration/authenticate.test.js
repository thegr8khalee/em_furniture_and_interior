import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT, calculateJwkThumbprint } from 'jose';
import User from '../../src/models/user.model.js';
import Admin from '../../src/models/admin.model.js';
import { identify, requireUser, requireStaff } from '../../src/middleware/authenticate.js';
import { requirePermissions } from '../../src/middleware/requirePermissions.js';
import { PERMISSIONS } from '../../src/lib/permissions.js';
import { resetJwksCache } from '../../src/lib/supabaseAuth.js';
import { connectTestDb, closeTestDb, clearCollections } from '../helpers/testApp.js';

/**
 * Actor resolution against a real database (finding F-10).
 *
 * The behaviour that matters: staff and customers now share one Supabase user
 * pool, and which one a caller is comes from a database lookup — never from a
 * claim inside the token, which a client can influence.
 */

const PROJECT = 'https://test-project.supabase.co';
let privateKey;
let jwks;
let app;

const tokenFor = (sub, claims = {}) =>
  new SignJWT({ role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: jwks.keys[0].kid })
    .setIssuedAt()
    .setIssuer(`${PROJECT}/auth/v1`)
    .setAudience('authenticated')
    .setSubject(sub)
    .setExpirationTime('1h')
    .sign(privateKey);

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const pub = await exportJWK(pair.publicKey);
  pub.kid = await calculateJwkThumbprint(pub);
  pub.alg = 'ES256';
  jwks = { keys: [pub] };

  await connectTestDb();

  app = express();
  app.use(express.json());
  app.use(identify);
  app.get('/whoami', (req, res) => res.json({ actor: req.actor ?? null, authError: req.authError ?? null }));
  app.get('/account', requireUser, (req, res) => res.json({ email: req.user.email }));
  app.get('/console', requireStaff, (req, res) => res.json({ role: req.adminRole }));
  app.get('/console/finance', requireStaff, requirePermissions([PERMISSIONS.FINANCE_VIEW]), (req, res) =>
    res.json({ ok: true })
  );
}, 120000);

afterAll(async () => closeTestDb());

beforeEach(async () => {
  await clearCollections();
  process.env.SUPABASE_URL = PROJECT;
  process.env.SUPABASE_JWKS_URL = `${PROJECT}/auth/v1/.well-known/jwks.json`;
  resetJwksCache();
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, headers: new Map(), json: async () => jwks }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

const SUB_USER = 'aaaaaaaa-0000-0000-0000-000000000001';
const SUB_STAFF = 'bbbbbbbb-0000-0000-0000-000000000002';

const makeUser = () =>
  User.create({ username: 'Ada', email: 'ada@example.com', passwordHash: 'x', supabaseUserId: SUB_USER });
const makeAdmin = (role = 'admin') =>
  Admin.create({ username: 'root', email: 'root@example.com', passwordHash: 'x', role, supabaseUserId: SUB_STAFF });

const withToken = (agent, token) => agent.set('Authorization', `Bearer ${token}`);

describe('actor resolution', () => {
  test('resolves a linked customer', async () => {
    await makeUser();
    const res = await withToken(request(app).get('/whoami'), await tokenFor(SUB_USER));
    expect(res.body.actor).toMatchObject({ kind: 'customer', supabaseUserId: SUB_USER });
  });

  test('resolves linked staff with their permissions', async () => {
    await makeAdmin('admin');
    const res = await withToken(request(app).get('/whoami'), await tokenFor(SUB_STAFF));
    expect(res.body.actor.kind).toBe('staff');
    expect(res.body.actor.permissions).toContain(PERMISSIONS.FINANCE_VIEW);
  });

  test('resolves an anonymous sign-in as a guest', async () => {
    const token = await tokenFor('cccccccc-0000-0000-0000-000000000003', { is_anonymous: true });
    const res = await withToken(request(app).get('/whoami'), token);
    expect(res.body.actor).toMatchObject({ kind: 'guest' });
  });

  test('marks a Supabase identity with no local record as unlinked', async () => {
    const res = await withToken(request(app).get('/whoami'), await tokenFor('dddddddd-0000-0000-0000-000000000004'));
    expect(res.body.actor.kind).toBe('unlinked');
  });

  test('passes through with no actor when no token is sent', async () => {
    const res = await request(app).get('/whoami');
    expect(res.body.actor).toBeNull();
  });

  test('records the reason a bad token failed without throwing', async () => {
    const res = await withToken(request(app).get('/whoami'), 'garbage.token.here');
    expect(res.body.actor).toBeNull();
    expect(res.body.authError).toBeTruthy();
  });

  // Authorization must never come from the token. A client can set
  // user_metadata on itself; the database is the only authority.
  test('ignores a role claim smuggled in the token', async () => {
    await makeUser();
    const token = await tokenFor(SUB_USER, { user_metadata: { role: 'super_admin' }, app_role: 'super_admin' });
    const res = await withToken(request(app).get('/whoami'), token);
    expect(res.body.actor.kind).toBe('customer');
    expect(res.body.actor.permissions).toBeUndefined();
  });

  // The collision that finding F-10 was about: one identity that is both.
  test('resolves an identity present in both collections as staff', async () => {
    await User.create({ username: 'Dual', email: 'dual@example.com', passwordHash: 'x', supabaseUserId: SUB_STAFF });
    await makeAdmin('super_admin');
    const res = await withToken(request(app).get('/whoami'), await tokenFor(SUB_STAFF));
    expect(res.body.actor.kind).toBe('staff');
  });
});

describe('guards', () => {
  test('requireUser admits a customer and refuses a guest', async () => {
    await makeUser();
    expect((await withToken(request(app).get('/account'), await tokenFor(SUB_USER))).status).toBe(200);

    const guest = await tokenFor('eeeeeeee-0000-0000-0000-000000000005', { is_anonymous: true });
    expect((await withToken(request(app).get('/account'), guest)).status).toBe(401);
  });

  test('requireStaff refuses a customer with 403, not 401', async () => {
    await makeUser();
    const res = await withToken(request(app).get('/console'), await tokenFor(SUB_USER));
    expect(res.status).toBe(403);
  });

  test('requireStaff refuses an absent token with 401', async () => {
    expect((await request(app).get('/console')).status).toBe(401);
  });

  test('permissions still gate staff routes', async () => {
    await makeAdmin('editor'); // no finance.view
    const token = await tokenFor(SUB_STAFF);
    expect((await withToken(request(app).get('/console'), token)).status).toBe(200);
    expect((await withToken(request(app).get('/console/finance'), token)).status).toBe(403);
  });

  test('a super_admin passes the permission gate', async () => {
    await makeAdmin('super_admin');
    const res = await withToken(request(app).get('/console/finance'), await tokenFor(SUB_STAFF));
    expect(res.status).toBe(200);
  });

  // Permissions are read per request, so a change takes effect immediately —
  // the one genuinely good property of the outgoing middleware, preserved.
  test('a role change takes effect on the next request', async () => {
    const admin = await makeAdmin('editor');
    const token = await tokenFor(SUB_STAFF);
    expect((await withToken(request(app).get('/console/finance'), token)).status).toBe(403);

    admin.role = 'admin';
    await admin.save();
    expect((await withToken(request(app).get('/console/finance'), token)).status).toBe(200);
  });
});
