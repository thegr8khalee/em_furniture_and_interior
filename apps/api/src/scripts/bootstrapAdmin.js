#!/usr/bin/env node
/**
 * Create the first console account.
 *
 * On an empty database there is no admin to sign in as, and the console is
 * unreachable. This creates the Supabase identity and the linked `admins`
 * record together, so the account works on the Supabase path from the outset
 * rather than needing a later import.
 *
 *   BOOTSTRAP_ADMIN_PASSWORD='…' npm run auth:bootstrap-admin -w apps/api -- \
 *     --email you@example.com --username you --role super_admin
 *
 * The password comes from the environment, never an argument: command lines
 * are visible in shell history and in `ps`.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/admin.model.js';
import { findByEmail, createUser, databaseNameFrom } from './importUsersToSupabase.js';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const ROLES = ['super_admin', 'admin', 'editor', 'support', 'social_media_manager'];

const run = async () => {
  const email = (arg('email') || '').trim().toLowerCase();
  const username = arg('username') || email.split('@')[0];
  const role = arg('role', 'super_admin');
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  const problems = [];
  if (!email) problems.push('--email is required');
  if (!password) problems.push('BOOTSTRAP_ADMIN_PASSWORD is required (not a CLI argument)');
  if (password && password.length < 12) problems.push('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  if (!ROLES.includes(role)) problems.push(`--role must be one of: ${ROLES.join(', ')}`);
  for (const key of ['MONGODB_URI', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[key]) problems.push(`${key} is required`);
  }
  if (problems.length) {
    console.error('Cannot continue:\n  - ' + problems.join('\n  - '));
    process.exit(2);
  }

  const dbName = databaseNameFrom(process.env.MONGODB_URI);
  if (!dbName) {
    console.error('MONGODB_URI has no database name; it would write to "test". Add one.');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`database "${dbName}"`);

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Adopt an existing Supabase identity rather than failing, so a re-run
    // after a partial failure completes instead of dead-ending.
    let identity = await findByEmail(email);
    if (identity) {
      console.log('  supabase: existing identity adopted');
    } else {
      identity = await createUser({
        email,
        passwordHash,
        metadata: { username, account_type: 'staff', role },
      });
      console.log('  supabase: identity created');
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      existing.username = username;
      existing.role = role;
      existing.passwordHash = passwordHash;
      existing.supabaseUserId = identity.id;
      await existing.save();
      console.log('  mongo   : existing admin updated and linked');
    } else {
      await Admin.create({ email, username, role, passwordHash, supabaseUserId: identity.id });
      console.log('  mongo   : admin created and linked');
    }

    console.log(`\nDone. Sign in at /admin/login as ${email} (${role}).`);
  } finally {
    await mongoose.disconnect();
  }
};

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('bootstrapAdmin.js');
if (invokedDirectly) {
  run().catch(async (error) => {
    console.error('Bootstrap failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

export { run };
