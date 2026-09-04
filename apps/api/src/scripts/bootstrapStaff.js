import dotenv from 'dotenv';
import { QueryTypes } from 'sequelize';
import { getSequelize, closeSequelize } from '../db/sequelize.js';
import { registerStaff } from '../services/identity.js';

dotenv.config();

/**
 * Creates the first console account.
 *
 * `POST /api/admin/signup` requires an operator who already holds
 * `admin.dashboard.view`, which is what stops it being an open door — and also
 * means a fresh database has no way to make the first one. This is that way.
 *
 * The password comes from the environment, never an argument: command lines end
 * up in shell history and in `ps`.
 *
 * Idempotent. A re-run after a partial failure reports the existing account and
 * exits 0 rather than dead-ending; it never overwrites the password of an
 * account that already exists, because a bootstrap script silently resetting a
 * live owner's credentials is a worse outcome than an error.
 */
const main = async () => {
  const email = process.env.BOOTSTRAP_STAFF_EMAIL;
  const password = process.env.BOOTSTRAP_STAFF_PASSWORD;
  const username = process.env.BOOTSTRAP_STAFF_USERNAME || 'Owner';

  if (!email || !password) {
    console.error(
      'Set BOOTSTRAP_STAFF_EMAIL and BOOTSTRAP_STAFF_PASSWORD (and optionally\n' +
        'BOOTSTRAP_STAFF_USERNAME) in the environment, then re-run.'
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('BOOTSTRAP_STAFF_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const db = getSequelize();

  const existing = await db.query(
    'SELECT id, email, role FROM staff WHERE email = :email',
    { replacements: { email }, type: QueryTypes.SELECT }
  );

  if (existing.length > 0) {
    console.log(`${email} already exists as ${existing[0].role} — nothing to do.`);
    return;
  }

  const staff = await registerStaff({ username, email, password, role: 'super_admin' }, db);
  console.log(`Created super_admin ${staff.email} (${staff.id}).`);
};

main()
  .catch((error) => {
    console.error('Could not bootstrap the first operator:', error.message);
    process.exitCode = 1;
  })
  .finally(closeSequelize);
