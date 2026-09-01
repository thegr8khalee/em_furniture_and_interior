import { jest } from '@jest/globals';
import User from '../../src/models/user.model.js';
import Admin from '../../src/models/admin.model.js';
import {
  importCollection,
  USER_METADATA,
  ADMIN_METADATA,
  databaseNameFrom,
} from '../../src/scripts/importUsersToSupabase.js';
import { connectTestDb, closeTestDb, clearCollections } from '../helpers/testApp.js';

/**
 * Import behaviour, with the Supabase Admin API stubbed.
 *
 * The properties worth pinning are the ones a partially-failed run depends on:
 * already-linked accounts are skipped, an email that already exists in Supabase
 * is adopted rather than duplicated, and a failure on one account does not stop
 * the rest. A long import fails partway; re-running must be safe.
 */

const SUPABASE_URL = 'https://test-project.supabase.co';

// Ids must be unique across stub instances, not just within one. Reusing them
// between runs collides with the sparse unique index on supabaseUserId — which
// real Supabase would never do, and which masked the behaviour under test.
let idSeq = 0;

const stubSupabase = ({ existing = {}, failEmails = [] } = {}) => {
  const created = [];
  global.fetch = jest.fn(async (url, opts = {}) => {
    const href = String(url);

    if (href.includes('/admin/users?filter=')) {
      const email = decodeURIComponent(href.split('filter=')[1]);
      const hit = existing[email.toLowerCase()];
      return { ok: true, status: 200, json: async () => ({ users: hit ? [hit] : [] }) };
    }

    if (href.endsWith('/auth/v1/admin/users') && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (failEmails.includes(body.email)) {
        return { ok: false, status: 422, json: async () => ({ msg: 'simulated failure' }) };
      }
      const user = { id: `sb-${++idSeq}`, email: body.email, password_hash: body.password_hash };
      created.push(user);
      return { ok: true, status: 200, json: async () => user };
    }

    throw new Error(`unexpected fetch: ${href}`);
  });
  return { created };
};

beforeAll(async () => {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  await connectTestDb();
}, 120000);

afterAll(async () => closeTestDb());

beforeEach(async () => {
  idSeq = 0;
  await clearCollections();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('importCollection', () => {
  test('links each account to the id Supabase returned', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: '$2b$10$x' });
    await User.create({ username: 'B', email: 'b@example.com', passwordHash: '$2b$10$y' });
    const { created } = stubSupabase();

    const stats = await importCollection('user', User, USER_METADATA);

    expect(stats).toMatchObject({ total: 2, created: 2, failed: 0 });
    expect(created).toHaveLength(2);
    const linked = await User.find().sort('email');
    expect(linked.map((u) => u.supabaseUserId)).toEqual(['sb-1', 'sb-2']);
  });

  test('sends the original bcrypt hash, so no password is reset', async () => {
    const hash = '$2b$10$abcdefghijklmnopqrstuv';
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: hash });
    const { created } = stubSupabase();

    await importCollection('user', User, USER_METADATA);

    expect(created[0].password_hash).toBe(hash);
  });

  test('skips accounts that are already linked', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: 'x', supabaseUserId: 'sb-existing' });
    const { created } = stubSupabase();

    const stats = await importCollection('user', User, USER_METADATA);

    expect(stats.total).toBe(0);
    expect(created).toHaveLength(0);
  });

  // A long import fails partway. Re-running must adopt what already landed
  // rather than creating a second account for the same person.
  test('adopts an account that already exists in Supabase', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: 'x' });
    const { created } = stubSupabase({
      existing: { 'a@example.com': { id: 'sb-already-there', email: 'a@example.com' } },
    });

    const stats = await importCollection('user', User, USER_METADATA);

    expect(stats).toMatchObject({ adopted: 1, created: 0 });
    expect(created).toHaveLength(0);
    expect((await User.findOne({ email: 'a@example.com' })).supabaseUserId).toBe('sb-already-there');
  });

  test('one failure does not abort the rest of the run', async () => {
    await User.create({ username: 'A', email: 'ok@example.com', passwordHash: 'x' });
    await User.create({ username: 'B', email: 'bad@example.com', passwordHash: 'y' });
    await User.create({ username: 'C', email: 'ok2@example.com', passwordHash: 'z' });
    stubSupabase({ failEmails: ['bad@example.com'] });

    const stats = await importCollection('user', User, USER_METADATA);

    expect(stats).toMatchObject({ total: 3, created: 2, failed: 1 });
    expect(await User.countDocuments({ supabaseUserId: { $ne: null } })).toBe(2);
  });

  test('a re-run after a partial failure links only what is left', async () => {
    await User.create({ username: 'A', email: 'ok@example.com', passwordHash: 'x' });
    await User.create({ username: 'B', email: 'bad@example.com', passwordHash: 'y' });
    stubSupabase({ failEmails: ['bad@example.com'] });
    await importCollection('user', User, USER_METADATA);

    stubSupabase(); // the transient problem is gone
    const second = await importCollection('user', User, USER_METADATA);

    expect(second).toMatchObject({ total: 1, created: 1, failed: 0 });
    expect(await User.countDocuments({ supabaseUserId: null })).toBe(0);
  });

  test('a dry run reports what it would do and changes nothing', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: 'x' });
    const { created } = stubSupabase();

    const stats = await importCollection('user', User, USER_METADATA, { dryRun: true });

    expect(stats).toMatchObject({ total: 1, created: 1 });
    expect(created).toHaveLength(0);
    expect((await User.findOne()).supabaseUserId).toBeUndefined();
  });

  test('skips an account with no email or no password hash', async () => {
    await User.collection.insertOne({ username: 'Broken', email: 'broken@example.com' });
    stubSupabase();

    const stats = await importCollection('user', User, USER_METADATA);

    expect(stats).toMatchObject({ total: 1, skipped: 1, created: 0 });
  });

  test('carries staff role into user_metadata, for reference only', async () => {
    await Admin.create({ username: 'root', email: 'root@example.com', passwordHash: 'x', role: 'super_admin' });
    stubSupabase();

    await importCollection('admin', Admin, ADMIN_METADATA);

    const admin = await Admin.findOne();
    expect(admin.supabaseUserId).toBe('sb-1');
    expect(ADMIN_METADATA(admin)).toMatchObject({ account_type: 'staff', role: 'super_admin' });
  });
});

describe('local linkage constraints', () => {
  test('the sparse unique index permits many unlinked accounts', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: 'x' });
    await User.create({ username: 'B', email: 'b@example.com', passwordHash: 'y' });
    expect(await User.countDocuments({ supabaseUserId: { $in: [null, undefined] } })).toBe(2);
  });

  test('the same Supabase id cannot be linked to two accounts', async () => {
    await User.create({ username: 'A', email: 'a@example.com', passwordHash: 'x', supabaseUserId: 'sb-dup' });
    await expect(
      User.create({ username: 'B', email: 'b@example.com', passwordHash: 'y', supabaseUserId: 'sb-dup' })
    ).rejects.toThrow();
  });
});

/**
 * Atlas hands out connection strings with no database name. Connecting with one
 * lands in the driver default ("test"), where these collections do not exist —
 * so the import would find nothing and report success. Failing loudly instead
 * is the whole point of this guard.
 */
describe('databaseNameFrom', () => {
  test('returns null when the URI carries no database name', () => {
    expect(databaseNameFrom('mongodb+srv://u:p@c.mongodb.net/?appName=x')).toBeNull();
    expect(databaseNameFrom('mongodb+srv://u:p@c.mongodb.net/')).toBeNull();
    expect(databaseNameFrom('mongodb+srv://u:p@c.mongodb.net')).toBeNull();
  });

  test('extracts the database name when present', () => {
    expect(databaseNameFrom('mongodb+srv://u:p@c.mongodb.net/em_furniture?appName=x')).toBe('em_furniture');
    expect(databaseNameFrom('mongodb://localhost:27017/em_furniture')).toBe('em_furniture');
  });

  test('is not confused by an @ inside the password', () => {
    expect(databaseNameFrom('mongodb+srv://user:pa@ss@c.mongodb.net/db1')).toBe('db1');
  });
});
