import dotenv from 'dotenv';

// Loaded here as well as in setup.js: the timeout below has to be decided
// before the framework starts, and setup files run after.
dotenv.config();

/**
 * How long a test may take, decided by where the database is.
 *
 * Every integration suite creates a throwaway database and applies every
 * migration to it. Against a local server that is a couple of seconds; against
 * a hosted one it is around thirty, because each statement is a round trip.
 * The suites used to name 30s each, so pointing them at a hosted database
 * failed in `beforeAll` for every test at once — a timeout that reads exactly
 * like a broken schema.
 */
const testUrl = process.env.TEST_DATABASE_URL || '';
const isLocalDatabase =
  testUrl === '' || /(@|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(testUrl);

export default {
  testTimeout: isLocalDatabase ? 30000 : 180000,

  /**
   * How many suites may run at once, decided by the same thing.
   *
   * Jest defaults to one worker per core. Each one opens its own throwaway
   * database and its own pool on top, and a hosted PostgreSQL reached through a
   * session-mode pooler has a hard connection limit — so twenty-five suites on
   * eight workers exhausted it and four hundred tests failed at once, in suites
   * that pass in isolation and in small groups. The limit is the database's, not
   * the machine's.
   */
  maxWorkers: isLocalDatabase ? '50%' : 4,
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  // Builds the schema once and hands every worker a copy of it.
  globalSetup: '<rootDir>/__tests__/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/globalTeardown.js',
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/seed/**',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
