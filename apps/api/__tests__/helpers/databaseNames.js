/**
 * Where the test databases live, and what they are called.
 *
 * Shared by the global setup, which builds the template, and the per-suite
 * helper, which copies it — so the two cannot disagree about the name.
 */

/**
 * The server the throwaway databases are created on.
 *
 * There is no default. It used to fall back to a local PostgreSQL, which is how
 * a run with `TEST_DATABASE_URL` unset could silently point somewhere nobody
 * meant. An unset variable is a refusal now.
 */
export const ADMIN_URL = () => {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. These tests create and drop throwaway ' +
        'databases and will not guess where to do it.'
    );
  }

  return url;
};

/** Everything this suite creates is named this way, and nothing else is touched. */
const THROWAWAY = /^em_test_[a-z0-9_]+$/;

/** The schema, migrated once per run and copied per worker. */
export const TEMPLATE_DATABASE = 'em_test_template';

export const workerDatabase = () => `em_test_${process.env.JEST_WORKER_ID || '1'}`;

export const urlFor = (name) => {
  const url = new URL(ADMIN_URL());
  url.pathname = `/${name}`;
  return url.toString();
};

/**
 * Refuses to drop or write to anything that is not one of ours.
 *
 * The suite issues `DROP DATABASE ... WITH (FORCE)` and creates operators with
 * a password that is committed to this repository. Both are safe against a
 * database called `em_test_3` and catastrophic against one called `postgres` —
 * and on a hosted Supabase project the application's database *is* `postgres`,
 * one connection string away from the admin one used here.
 *
 * Twelve live `super_admin` accounts once ended up in the real database this
 * way. The name is checked rather than the URL because the two connection
 * strings legitimately differ — the app uses the pooler in transaction mode on
 * 6543 and migrations need session mode on 5432, for the same database.
 */
export const assertThrowaway = (name) => {
  if (!THROWAWAY.test(name)) {
    throw new Error(
      `Refusing to touch a database called "${name}". This suite only creates, ` +
        'drops and writes to databases named em_test_*.'
    );
  }

  return name;
};
