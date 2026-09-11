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

// Accounts, over HTTP.
//
// Everything here is driven the way a browser drives it — a cookie jar and JSON
// bodies — because the parts that broke historically were the seams: which
// cookie is set, which principal a token names, and whether the guest cart
// survives signing in. A service-level test proves none of that.
//
// The mailer is the one thing replaced with a double. It reaches the Gmail API,
// which is not available here and is not what these tests are about; capturing
// the message is also the only way to get at a reset link, which is exactly how
// a real user gets one.


const sent = [];

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async (message) => {
    sent.push(message);
    return { id: 'test-message' };
  }),
}));

let app;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  ({ default: app } = await import('../../src/app.js'));
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

beforeEach(() => {
  sent.length = 0;
});

/** A fresh address per test, so no two tests fight over one account. */
const someEmail = () => `shopper-${Math.random().toString(36).slice(2)}@example.com`;

/**
 * Each request comes from its own address.
 *
 * The API's rate limiters are real and are keyed on the client IP: five failed
 * sign-ins and three password-reset requests per window. A suite that shares one
 * address trips them partway through and then tests the limiter rather than the
 * thing it meant to.
 */
let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.0.${(callers >> 8) & 255}.${callers++ & 255}`);

const cookiesFrom = (res) => res.headers['set-cookie'] || [];

const jwtCookie = (res) => cookiesFrom(res).find((c) => c.startsWith('jwt='));

/** The cookie value alone, as a browser would send it back. */
const asCookie = (res) => [jwtCookie(res).split(';')[0]];

const signUp = (overrides = {}) =>
  api('post', '/api/auth/signup')
    .send({
      fullName: 'Ada Obi',
      email: someEmail(),
      password: 'Password123!',
      ...overrides,
    });

/** An operator, created the way the bootstrap script does. */
const makeStaff = async (overrides = {}) => {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = overrides.email ?? `ops-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? 'Password123!';
  const staff = await registerStaff({
    username: overrides.username ?? `ops-${Math.random().toString(36).slice(2)}`,
    email,
    password,
    role: overrides.role ?? 'admin',
  });
  return { ...staff, password };
};

describe('signing up', () => {
  it('creates an account, sets the session cookie and reports the shopper', async () => {
    const email = someEmail();
    const res = await signUp({ email, fullName: 'Ada Obi', phoneNumber: '08030000000' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      username: 'Ada Obi',
      email,
      phoneNumber: '08030000000',
      loyaltyPoints: 0,
    });
    expect(res.body._id).toEqual(res.body.id);
    expect(jwtCookie(res)).toBeDefined();
  });

  it('never puts the password or its hash in the response', async () => {
    const res = await signUp();

    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('stores the password hashed', async () => {
    const email = someEmail();
    await signUp({ email, password: 'Password123!' });

    const [row] = await getDb().query(
      'SELECT password_hash FROM customers WHERE email = :email',
      { replacements: { email }, type: QueryTypes.SELECT }
    );

    expect(row.password_hash).not.toBe('Password123!');
    expect(row.password_hash.startsWith('$2')).toBe(true);
  });

  it('refuses an address that is already registered', async () => {
    const email = someEmail();
    await signUp({ email });

    const res = await signUp({ email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email already in use');
  });

  it('treats an address as the same one regardless of case', async () => {
    const email = someEmail();
    await signUp({ email });

    const res = await signUp({ email: email.toUpperCase() });

    expect(res.status).toBe(400);
  });

  it('asks for each missing field by name', async () => {
    expect((await signUp({ fullName: undefined })).body.message).toBe(
      'Full name cannot be empty'
    );
    expect((await signUp({ email: undefined })).body.message).toBe('Email cannot be empty');
    expect((await signUp({ password: undefined })).body.message).toBe(
      'Password cannot be empty'
    );
  });
});

describe('signing in', () => {
  it('accepts the right password', async () => {
    const email = someEmail();
    await signUp({ email, password: 'Password123!' });

    const res = await api('post', '/api/auth/login')
      .send({ email, password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(jwtCookie(res)).toBeDefined();
  });

  it('answers an unknown address and a wrong password identically', async () => {
    const email = someEmail();
    await signUp({ email, password: 'Password123!' });

    const wrongPassword = await api('post', '/api/auth/login')
      .send({ email, password: 'not-the-password' });
    const noSuchAccount = await api('post', '/api/auth/login')
      .send({ email: someEmail(), password: 'Password123!' });

    expect(wrongPassword.status).toBe(400);
    expect(noSuchAccount.status).toBe(400);
    expect(wrongPassword.body).toEqual(noSuchAccount.body);
  });

  it('clears the session cookie on logout', async () => {
    const res = await api('post', '/api/auth/logout');

    expect(res.status).toBe(200);
    expect(jwtCookie(res)).toMatch(/^jwt=;/);
  });
});

describe('the guest cart on sign-in', () => {
  let productId;

  beforeAll(async () => {
    productId = await insertProduct({ name: 'Milano Sofa', price: 45000000 });
  });

  it('follows the shopper into their new account', async () => {
    const anonymousId = `anon-${Math.random().toString(36).slice(2)}`;

    await api('put', '/api/cart/add')
      .set('Cookie', [`anonymousId=${anonymousId}`])
      .send({ itemId: productId, quantity: 3 });

    const signedUp = await api('post', '/api/auth/signup')
      .set('Cookie', [`anonymousId=${anonymousId}`])
      .send({ fullName: 'Ada Obi', email: someEmail(), password: 'Password123!' });

    expect(signedUp.status).toBe(201);

    const cart = await api('get', '/api/cart').set('Cookie', asCookie(signedUp));

    expect(cart.status).toBe(200);
    expect(cart.body.cart).toEqual([
      { _id: productId, item: productId, itemType: 'Product', quantity: 3 },
    ]);
  });

  it('is adopted on sign-in too, not only on registration', async () => {
    const email = someEmail();
    await signUp({ email, password: 'Password123!' });

    const anonymousId = `anon-${Math.random().toString(36).slice(2)}`;
    await api('put', '/api/cart/add')
      .set('Cookie', [`anonymousId=${anonymousId}`])
      .send({ itemId: productId, quantity: 1 });

    const loggedIn = await api('post', '/api/auth/login')
      .set('Cookie', [`anonymousId=${anonymousId}`])
      .send({ email, password: 'Password123!' });

    const cart = await api('get', '/api/cart').set('Cookie', asCookie(loggedIn));

    expect(cart.body.cart).toHaveLength(1);
  });
});

describe('who am I', () => {
  it('refuses a request with no cookie', async () => {
    const res = await api('get', '/api/auth/check');

    expect(res.status).toBe(401);
  });

  it('reports the signed-in shopper', async () => {
    const email = someEmail();
    const signedUp = await signUp({ email });

    const res = await api('get', '/api/auth/check').set('Cookie', asCookie(signedUp));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email, role: 'user' });
  });

  it('clears a cookie it refuses, so the client stops replaying it', async () => {
    const res = await api('get', '/api/auth/check').set('Cookie', ['jwt=not-a-token']);

    expect(res.status).toBe(401);
    expect(jwtCookie(res)).toMatch(/^jwt=;/);
  });

  it('refuses a token for an account that has since been deleted', async () => {
    const signedUp = await signUp();
    const cookie = asCookie(signedUp);

    await api('delete', '/api/auth/delete').set('Cookie', cookie);

    const res = await api('get', '/api/auth/check').set('Cookie', cookie);

    expect(res.status).toBe(401);
  });

  it('reports an operator with the permissions their role carries', async () => {
    const staff = await makeStaff({ role: 'editor' });

    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });
    const res = await api('get', '/api/auth/check').set('Cookie', asCookie(loggedIn));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'admin', adminRole: 'editor' });
    expect(res.body.permissions).toEqual(['blog.manage', 'faq.manage']);
  });

  it('verifies an operator on /api/admin/check using admin_jwt cookie', async () => {
    const staff = await makeStaff({ role: 'editor' });

    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });
    const adminCookie = cookiesFrom(loggedIn).find((c) => c.startsWith('admin_jwt='));
    expect(adminCookie).toBeDefined();

    const res = await api('get', '/api/admin/check')
      .set('Cookie', [adminCookie.split(';')[0]]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'admin', adminRole: 'editor' });
    expect(res.body.permissions).toEqual(['blog.manage', 'faq.manage']);
  });

  it('refuses a customer session cookie on /api/admin/check', async () => {
    const signedUp = await signUp();
    const res = await api('get', '/api/admin/check')
      .set('Cookie', asCookie(signedUp));

    expect(res.status).toBe(401);
  });
});

describe('a shopper managing their own account', () => {
  it('updates the fields it is given and leaves the others alone', async () => {
    const signedUp = await signUp({ phoneNumber: '08030000000' });
    const cookie = asCookie(signedUp);

    const res = await api('put', '/api/auth/update')
      .set('Cookie', cookie)
      .send({ username: 'Ada N. Obi' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('Ada N. Obi');
    expect(res.body.phoneNumber).toBe('08030000000');
    expect(res.body.email).toBe(signedUp.body.email);
  });

  it('refuses an address another account already holds', async () => {
    const taken = await signUp();
    const signedUp = await signUp();

    const res = await api('put', '/api/auth/update')
      .set('Cookie', asCookie(signedUp))
      .send({ email: taken.body.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already in use/i);
  });

  it('changes a password only when the old one is right', async () => {
    const email = someEmail();
    const signedUp = await signUp({ email, password: 'Password123!' });
    const cookie = asCookie(signedUp);

    const wrong = await api('put', '/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ oldPassword: 'not-the-password', newPassword: 'Password456!' });

    expect(wrong.status).toBe(400);

    const right = await api('put', '/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ oldPassword: 'Password123!', newPassword: 'Password456!' });

    expect(right.status).toBe(200);

    const oldPassword = await api('post', '/api/auth/login')
      .send({ email, password: 'Password123!' });
    const newPassword = await api('post', '/api/auth/login')
      .send({ email, password: 'Password456!' });

    expect(oldPassword.status).toBe(400);
    expect(newPassword.status).toBe(200);
  });

  it('requires a session for anything that acts on the account', async () => {
    const update = await api('put', '/api/auth/update').send({ username: 'x' });
    const remove = await api('delete', '/api/auth/delete');

    expect(update.status).toBe(401);
    expect(remove.status).toBe(401);
  });
});

describe('resetting a forgotten password', () => {
  /** The link is only ever delivered by email, so the test reads it there too. */
  const resetTokenFromEmail = () => {
    const message = sent.at(-1);
    return message.text.match(/reset-password\/([a-f0-9]+)/)[1];
  };

  it('sends a link and accepts it once', async () => {
    const email = someEmail();
    await signUp({ email, password: 'Password123!' });

    const asked = await api('post', '/api/auth/forgot-password').send({ email });
    expect(asked.status).toBe(200);
    expect(sent).toHaveLength(1);

    const token = resetTokenFromEmail();

    const reset = await api('post', `/api/auth/reset-password/${token}`)
      .send({ newPassword: 'Password456!' });
    expect(reset.status).toBe(200);

    const signedIn = await api('post', '/api/auth/login')
      .send({ email, password: 'Password456!' });
    expect(signedIn.status).toBe(200);

    // Spent, so a link read out of an inbox later is worth nothing.
    const again = await api('post', `/api/auth/reset-password/${token}`)
      .send({ newPassword: 'Password789!' });
    expect(again.status).toBe(400);
  });

  it('stores the token hashed, so the database row is not itself a live link', async () => {
    const email = someEmail();
    await signUp({ email });
    await api('post', '/api/auth/forgot-password').send({ email });

    const token = resetTokenFromEmail();
    const [row] = await getDb().query(
      'SELECT password_reset_token FROM customers WHERE email = :email',
      { replacements: { email }, type: QueryTypes.SELECT }
    );

    expect(row.password_reset_token).not.toBe(token);
    expect(row.password_reset_token).toHaveLength(64);
  });

  it('refuses an expired token', async () => {
    const email = someEmail();
    await signUp({ email });
    await api('post', '/api/auth/forgot-password').send({ email });
    const token = resetTokenFromEmail();

    await getDb().query(
      `UPDATE customers SET password_reset_expires = now() - interval '1 minute'
        WHERE email = :email`,
      { replacements: { email } }
    );

    const res = await api('post', `/api/auth/reset-password/${token}`)
      .send({ newPassword: 'Password456!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('says the same thing for an address with no account, and sends nothing', async () => {
    const known = someEmail();
    await signUp({ email: known });

    const hasAccount = await api('post', '/api/auth/forgot-password').send({ email: known });
    sent.length = 0;
    const hasNone = await api('post', '/api/auth/forgot-password')
      .send({ email: someEmail() });

    expect(hasNone.status).toBe(hasAccount.status);
    expect(hasNone.body).toEqual(hasAccount.body);
    expect(sent).toHaveLength(0);
  });
});

describe('operators', () => {
  it('signs in and reports the role and its permissions', async () => {
    const staff = await makeStaff({ role: 'super_admin' });

    const res = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'admin', adminRole: 'super_admin' });
    expect(res.body.permissions).toContain('finance.view');
  });

  it('records the sign-in', async () => {
    const staff = await makeStaff();

    await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    const [row] = await getDb().query('SELECT last_login_at FROM staff WHERE id = :id', {
      replacements: { id: staff.id },
      type: QueryTypes.SELECT,
    });
    expect(row.last_login_at).not.toBeNull();
  });

  it('refuses a deactivated account, even with the right password', async () => {
    const staff = await makeStaff();
    await getDb().query('UPDATE staff SET is_active = false WHERE id = :id', {
      replacements: { id: staff.id },
    });

    const res = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    expect(res.status).toBe(403);
  });

  it('stops honouring a token issued before the account was deactivated', async () => {
    const staff = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    await getDb().query('UPDATE staff SET is_active = false WHERE id = :id', {
      replacements: { id: staff.id },
    });

    const res = await api('post', '/api/admin/operations/addProduct')
      .set('Cookie', asCookie(loggedIn))
      .send({ name: 'Anything' });

    expect(res.status).toBe(403);
  });

  it('enforces the permissions the role does not carry', async () => {
    const editor = await makeStaff({ role: 'editor' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: editor.email, password: editor.password });

    const res = await api('post', '/api/admin/operations/addProduct')
      .set('Cookie', asCookie(loggedIn))
      .send({ name: 'Milano Sofa', price: 1000 });

    expect(res.status).toBe(403);
    expect(res.body.requiredPermissions).toEqual(['products.manage']);
  });

  it('sees a permission revoked on the next request, not fifteen days later', async () => {
    const staff = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    await getDb().query(
      `UPDATE staff SET role = 'editor', permissions = '{}' WHERE id = :id`,
      { replacements: { id: staff.id } }
    );

    const res = await api('post', '/api/admin/operations/addProduct')
      .set('Cookie', asCookie(loggedIn))
      .send({ name: 'Milano Sofa', price: 1000 });

    expect(res.status).toBe(403);
  });

  it('refuses to create a second account with an address already taken', async () => {
    const owner = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: owner.email, password: owner.password });

    const res = await api('post', '/api/admin/signup')
      .set('Cookie', asCookie(loggedIn))
      .send({ username: 'Someone Else', email: owner.email, password: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('does not sign the caller in as the account they just created', async () => {
    const owner = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: owner.email, password: owner.password });

    const created = await api('post', '/api/admin/signup')
      .set('Cookie', asCookie(loggedIn))
      .send({ username: `ops-${Date.now()}`, email: someEmail(), password: 'Password123!' });

    expect(created.status).toBe(201);
    expect(jwtCookie(created)).toBeUndefined();
  });

  it('lets only a super_admin create another operator', async () => {
    // `support` holds admin.dashboard.view, which is what this route used to
    // ask for — so a support account could mint a colleague with more access
    // than itself.
    const support = await makeStaff({ role: 'support' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: support.email, password: support.password });

    const res = await api('post', '/api/admin/signup')
      .set('Cookie', asCookie(loggedIn))
      .send({
        username: `ops-${Date.now()}`,
        email: someEmail(),
        password: 'Password123!',
        role: 'super_admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.requiredPermissions).toEqual(['staff.manage']);
  });

  it('will not create an operator for an anonymous caller', async () => {
    const res = await api('post', '/api/admin/signup')
      .send({ username: 'Intruder', email: someEmail(), password: 'Password123!' });

    expect(res.status).toBe(401);
  });
});

describe('the two kinds of principal do not substitute for each other', () => {
  it("refuses a shopper's token on a console route", async () => {
    const signedUp = await signUp();

    const res = await api('post', '/api/admin/operations/addProduct')
      .set('Cookie', asCookie(signedUp))
      .send({ name: 'Milano Sofa' });

    expect(res.status).toBe(403);
  });

  it("refuses an operator's token on a shopper route", async () => {
    const staff = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    const res = await api('put', '/api/auth/update')
      .set('Cookie', asCookie(loggedIn))
      .send({ username: 'x' });

    expect(res.status).toBe(403);
  });

  it('treats an operator browsing the storefront as an anonymous shopper', async () => {
    const staff = await makeStaff({ role: 'super_admin' });
    const loggedIn = await api('post', '/api/admin/login')
      .send({ email: staff.email, password: staff.password });

    const res = await api('get', '/api/cart').set('Cookie', asCookie(loggedIn));

    expect(res.status).toBe(200);
    expect(res.body.cart).toEqual([]);
  });
});
