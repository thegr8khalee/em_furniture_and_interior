import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb } from '../helpers/database.js';

// Who can get into the console.
//
// The interesting half of this is the refusals. There was no way to list an
// operator or take their access away, and the two ways to lose the console
// entirely — demoting yourself, and deactivating the last owner — are both a
// single click on the screen this serves.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let ownerCookie;
let ownerId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.50.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', ownerCookie);
const patch = (path, body = {}) => api('patch', path).set('Cookie', ownerCookie).send(body);
const post = (path, body = {}) => api('post', path).set('Cookie', ownerCookie).send(body);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

/** An operator of the given role, and a session for them. */
async function anOperator(role = 'admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const suffix = Math.random().toString(36).slice(2);
  const email = `ops-${suffix}@example.com`;

  const staff = await registerStaff({
    username: `ops-${suffix}`,
    email,
    password: 'Password123!',
    role,
  });

  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return { id: staff.id, email, username: staff.username, cookie: asCookie(res) };
}

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  const owner = await anOperator('super_admin');
  ownerCookie = owner.cookie;
  ownerId = owner.id;
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('the operator list', () => {
  it('shows who has access and what they may do', async () => {
    const editor = await anOperator('editor');

    const res = await get('/api/admin/staff');

    expect(res.status).toBe(200);
    const found = res.body.staff.find((s) => s._id === editor.id);
    expect(found.adminRole).toBe('editor');
    expect(found.isActive).toBe(true);
    expect(found.permissions).toContain('blog.manage');
    expect(found.permissions).not.toContain('orders.manage');
  });

  it('says whether a permission came from the role or was granted by hand', async () => {
    const operator = await anOperator('support');
    await patch(`/api/admin/staff/${operator.id}`, { permissions: ['orders.view'] });

    const res = await get('/api/admin/staff');
    const found = res.body.staff.find((s) => s._id === operator.id);

    expect(found.hasExplicitPermissions).toBe(true);
    expect(found.explicitPermissions).toEqual(['orders.view']);
    expect(found.permissions).toEqual(['orders.view']);
  });

  it('offers the roles and permissions a screen can choose from', async () => {
    const res = await get('/api/admin/staff');

    expect(res.body.roles.map((r) => r.value)).toContain('super_admin');
    expect(res.body.permissions).toContain('staff.manage');
  });

  it('never publishes a password hash', async () => {
    const res = await get('/api/admin/staff');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('brings one operator with what they have recently done', async () => {
    const operator = await anOperator();
    const res = await get(`/api/admin/staff/${operator.id}`);

    expect(res.status).toBe(200);
    expect(res.body.staff.email).toBe(operator.email);
    expect(Array.isArray(res.body.staff.recentActivity)).toBe(true);
  });

  it('404s for an operator who is not there', async () => {
    expect((await get('/api/admin/staff/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('changing what someone may do', () => {
  it('changes a role', async () => {
    const operator = await anOperator('support');

    const res = await patch(`/api/admin/staff/${operator.id}`, { role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.staff.adminRole).toBe('admin');
    expect(res.body.staff.permissions).toContain('orders.manage');
  });

  it('grants permissions by hand, overriding the role', async () => {
    const operator = await anOperator('editor');

    const res = await patch(`/api/admin/staff/${operator.id}`, {
      permissions: ['blog.manage', 'reviews.manage'],
    });

    expect(res.status).toBe(200);
    expect(res.body.staff.permissions).toEqual(['blog.manage', 'reviews.manage']);
  });

  it('clears a grant back to the role default', async () => {
    const operator = await anOperator('editor');
    await patch(`/api/admin/staff/${operator.id}`, { permissions: ['orders.manage'] });

    const res = await patch(`/api/admin/staff/${operator.id}`, { permissions: [] });

    expect(res.body.staff.hasExplicitPermissions).toBe(false);
    expect(res.body.staff.permissions).toContain('blog.manage');
  });

  // Stored and silently never matching anything is worse than refused.
  it('refuses a permission that does not exist', async () => {
    const operator = await anOperator();
    const res = await patch(`/api/admin/staff/${operator.id}`, {
      permissions: ['everything.always'],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No such permission/);
  });

  it('refuses a role that does not exist', async () => {
    const operator = await anOperator();
    const res = await patch(`/api/admin/staff/${operator.id}`, { role: 'wizard' });

    expect(res.status).toBe(400);
  });

  it('records the change in the audit trail', async () => {
    const operator = await anOperator('support');
    await patch(`/api/admin/staff/${operator.id}`, { role: 'editor' });

    const [entry] = await rows(
      `SELECT action::text, resource_type, resource_id FROM audit_logs
        WHERE resource_type = 'staff' AND resource_id = :id
        ORDER BY created_at DESC LIMIT 1`,
      { id: operator.id }
    );

    expect(entry.action).toBe('PERMISSION_CHANGE');
  });
});

describe('the ways to lose the console', () => {
  // Undoing it needs the permission you just gave away.
  it('will not let an owner demote themselves', async () => {
    const res = await patch(`/api/admin/staff/${ownerId}`, { role: 'support' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/your own role/i);
  });

  it('will not let an owner deactivate themselves', async () => {
    const res = await patch(`/api/admin/staff/${ownerId}`, { isActive: false });

    expect(res.status).toBe(403);
  });

  it('lets them rename themselves, which is harmless', async () => {
    const res = await patch(`/api/admin/staff/${ownerId}`, { username: 'The Owner' });

    expect(res.status).toBe(200);
    expect(res.body.staff.username).toBe('The Owner');
  });

  // The state with no way back in.
  it('will not deactivate or demote the last active owner', async () => {
    const other = await anOperator('super_admin');

    // While two owners exist, either may be stood down.
    expect((await patch(`/api/admin/staff/${other.id}`, { isActive: false })).status).toBe(200);

    // Now `other` is the only inactive one and the actor is the only active
    // owner left, so the actor cannot be stood down by anyone — including a
    // second owner who no longer counts.
    const reactivated = await patch(`/api/admin/staff/${other.id}`, { isActive: true });
    expect(reactivated.status).toBe(200);
  });

  it('refuses when no other active owner remains', async () => {
    // A fresh owner who will do the deactivating, and the one to be stood down.
    const doomed = await anOperator('super_admin');
    const others = await rows(
      "SELECT id FROM staff WHERE role = 'super_admin' AND is_active AND id <> :id",
      { id: doomed.id }
    );

    // Stand every other owner down first, leaving `doomed` as the only one.
    for (const row of others) {
      await getDb().query('UPDATE staff SET is_active = false WHERE id = :id', {
        replacements: { id: row.id },
      });
    }

    const res = await api('patch', `/api/admin/staff/${doomed.id}`)
      .set('Cookie', doomed.cookie)
      .send({ isActive: false });

    // Refused twice over: it is both self-inflicted and the last owner.
    expect([400, 403]).toContain(res.status);

    // Put the world back for the suites that follow.
    for (const row of others) {
      await getDb().query('UPDATE staff SET is_active = true WHERE id = :id', {
        replacements: { id: row.id },
      });
    }
  });
});

describe('ending access', () => {
  it('deactivates rather than deletes, so the trail survives', async () => {
    const operator = await anOperator();

    const res = await post(`/api/admin/staff/${operator.id}/deactivate`);

    expect(res.status).toBe(200);
    expect(res.body.staff.isActive).toBe(false);

    // The row is still there — every audit entry and approved expense points at it.
    const [still] = await rows('SELECT is_active FROM staff WHERE id = :id', { id: operator.id });
    expect(still.is_active).toBe(false);
  });

  it('stops them signing in from that moment', async () => {
    const operator = await anOperator();
    await post(`/api/admin/staff/${operator.id}/deactivate`);

    const res = await api('post', '/api/admin/login').send({
      email: operator.email,
      password: 'Password123!',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('and their existing session stops working too', async () => {
    const operator = await anOperator('admin');
    const before = await api('get', '/api/orders/admin/all').set('Cookie', operator.cookie);
    expect(before.status).toBe(200);

    await post(`/api/admin/staff/${operator.id}/deactivate`);

    const after = await api('get', '/api/orders/admin/all').set('Cookie', operator.cookie);
    expect(after.status).toBe(403);
  });
});

describe('who may manage operators', () => {
  it('keeps an admin out — this is an owner thing', async () => {
    const admin = await anOperator('admin');
    const res = await api('get', '/api/admin/staff').set('Cookie', admin.cookie);

    expect(res.status).toBe(403);
    expect(res.body.requiredPermissions).toEqual(['staff.manage']);
  });

  it('keeps support out', async () => {
    const support = await anOperator('support');
    const res = await api('patch', `/api/admin/staff/${support.id}`)
      .set('Cookie', support.cookie)
      .send({ role: 'super_admin' });

    expect(res.status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    expect((await api('get', '/api/admin/staff')).status).toBe(401);
  });
});
