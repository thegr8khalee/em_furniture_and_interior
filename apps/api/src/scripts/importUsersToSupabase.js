#!/usr/bin/env node
/**
 * Import Mongo users and admins into Supabase Auth.
 *
 * bcrypt hashes transfer directly, so nobody resets a password. This was
 * verified against the live project rather than taken from documentation: a
 * `$2b$10$` hash written by this codebase imports and authenticates with the
 * original plaintext.
 *
 *   node src/scripts/importUsersToSupabase.js --dry-run
 *   node src/scripts/importUsersToSupabase.js
 *
 * Idempotent: an account already carrying a supabaseUserId is skipped, and an
 * email already present in Supabase is adopted rather than duplicated. Safe to
 * re-run after a partial failure, which is the state a long import fails in.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';

// Read at call time, not module load, so the module can be imported by tests
// without demanding an environment or running the import.
const config = () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    url,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
};

export const findByEmail = async (email) => {
  const { url: base, headers } = config();
  const url = `${base}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const body = await res.json();
  return (body.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
};

export const createUser = async ({ email, passwordHash, metadata }) => {
  const { url: base, headers } = config();
  const res = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password_hash: passwordHash,
      // These accounts already existed and were already reachable by email;
      // forcing reconfirmation would lock everyone out on cutover day.
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.msg || body?.message || `HTTP ${res.status}`);
  return body;
};

export const importCollection = async (label, Model, toMetadata, { dryRun = false } = {}) => {
  const docs = await Model.find({ supabaseUserId: { $in: [null, undefined] } });
  const stats = { total: docs.length, created: 0, adopted: 0, skipped: 0, failed: 0 };

  for (const doc of docs) {
    const email = doc.email?.trim();
    if (!email || !doc.passwordHash) {
      console.warn(`  skip ${label} ${doc._id}: missing email or password hash`);
      stats.skipped += 1;
      continue;
    }

    try {
      let supabaseUser = await findByEmail(email);
      if (supabaseUser) {
        stats.adopted += 1;
      } else if (dryRun) {
        stats.created += 1;
        continue;
      } else {
        supabaseUser = await createUser({
          email,
          passwordHash: doc.passwordHash,
          metadata: toMetadata(doc),
        });
        stats.created += 1;
      }

      if (!dryRun) {
        doc.supabaseUserId = supabaseUser.id;
        await doc.save();
      }
    } catch (error) {
      console.error(`  FAILED ${label} ${email}: ${error.message}`);
      stats.failed += 1;
    }
  }

  return stats;
};

export const USER_METADATA = (d) => ({
  legacy_mongo_id: d._id.toString(),
  username: d.username,
  account_type: 'customer',
});

// Staff carry their role in user_metadata for convenience only. Authorization
// is always resolved from Mongo (later Postgres) — never from a token claim,
// which a client can influence.
export const ADMIN_METADATA = (d) => ({
  legacy_mongo_id: d._id.toString(),
  username: d.username,
  account_type: 'staff',
  role: d.role,
});

/**
 * A connection string with no database name silently connects to the driver
 * default ("test"), where these collections do not exist — so the import would
 * find nothing, import nothing, and report success. Atlas hands out URIs in
 * exactly that shape, so this is worth failing loudly on.
 */
export const databaseNameFrom = (uri) => {
  const afterHost = uri.split('://')[1]?.split('@').pop() ?? '';
  const path = afterHost.split('/').slice(1).join('/');
  return path.split('?')[0] || null;
};

const run = async (dryRun) => {
  const required = ['MONGODB_URI', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment: ${missing.join(', ')}`);
    process.exit(2);
  }

  const dbName = databaseNameFrom(process.env.MONGODB_URI);
  if (!dbName) {
    console.error(
      'MONGODB_URI has no database name, so this would connect to "test" and\n' +
      'silently import nothing. Add it before the query string, e.g.\n' +
      '  mongodb+srv://user:pass@cluster.mongodb.net/em_furniture?appName=website-db'
    );
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`${dryRun ? 'DRY RUN — ' : ''}database "${dbName}" -> ${config().url}\n`);

  // Print what is there before touching anything, so "0 imported" is obviously
  // an empty database rather than a successful no-op.
  const [userTotal, adminTotal, userLinked, adminLinked] = await Promise.all([
    User.countDocuments(),
    Admin.countDocuments(),
    User.countDocuments({ supabaseUserId: { $nin: [null, undefined] } }),
    Admin.countDocuments({ supabaseUserId: { $nin: [null, undefined] } }),
  ]);
  console.log(`found  users: ${userTotal} (${userLinked} already linked)`);
  console.log(`found  admins: ${adminTotal} (${adminLinked} already linked)\n`);

  if (userTotal === 0 && adminTotal === 0) {
    console.warn('No accounts found. Check the database name in MONGODB_URI.\n');
  }

  const users = await importCollection('user', User, USER_METADATA, { dryRun });
  console.log('users  ', users);
  const admins = await importCollection('admin', Admin, ADMIN_METADATA, { dryRun });
  console.log('admins ', admins);

  const failed = users.failed + admins.failed;
  await mongoose.disconnect();

  if (failed > 0) {
    console.error(`\n${failed} account(s) failed. Re-run to retry — already-linked accounts are skipped.`);
    process.exit(1);
  }
  console.log('\nDone.');
};

// Only run when invoked as a script, never on import.
const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith('importUsersToSupabase.js');

if (invokedDirectly) {
  run(process.argv.includes('--dry-run')).catch(async (error) => {
    console.error('Import failed:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
