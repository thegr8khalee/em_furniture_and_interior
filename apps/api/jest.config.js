export default {
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
