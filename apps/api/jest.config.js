import dotenv from 'dotenv';

// Loaded here as well as in setup.js: the timeout below has to be decided
// before the framework starts, and setup files run after.
dotenv.config();

/**
 * How long a test may take, decided by where the database is.
 *
 * Every integration suite creates a throwaway database and applies every
 * migration to it. Against a local server that is a couple of seconds; against
 * a hosted one it is minutes, because each statement is a round trip and the
 * template copy that would avoid it cannot work behind a connection pooler.
 *
 * The cost therefore grows with every migration added. It was 180s and a suite
 * began timing out in `beforeAll` at fifteen migrations — a failure that reads
 * exactly like a broken schema, because every test in the file fails at once
 * with nothing to say. If this is reached again the answer is not another
 * minute: it is making the template copy work.
 */
const testUrl = process.env.TEST_DATABASE_URL || '';
const isLocalDatabase =
  testUrl === '' || /(@|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(testUrl);

export default {
  testTimeout: isLocalDatabase ? 30000 : 420000,

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
