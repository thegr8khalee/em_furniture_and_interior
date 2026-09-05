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
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/seed/**',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
