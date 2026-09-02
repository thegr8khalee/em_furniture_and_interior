export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/seed/**',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
