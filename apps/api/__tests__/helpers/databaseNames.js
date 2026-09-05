/**
 * Where the test databases live, and what they are called.
 *
 * Shared by the global setup, which builds the template, and the per-suite
 * helper, which copies it — so the two cannot disagree about the name.
 */

export const ADMIN_URL = () =>
  process.env.TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/postgres';

/** The schema, migrated once per run and copied per worker. */
export const TEMPLATE_DATABASE = 'em_test_template';

export const workerDatabase = () => `em_test_${process.env.JEST_WORKER_ID || '1'}`;

export const urlFor = (name) => {
  const url = new URL(ADMIN_URL());
  url.pathname = `/${name}`;
  return url.toString();
};
