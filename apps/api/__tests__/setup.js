import dotenv from 'dotenv';

// The suite talks to a real database, and which one is a local decision that
// belongs in .env alongside every other connection string. Jest does not load
// it, so this does — without overriding anything already in the environment,
// which is how CI points the same suite at its own server.
dotenv.config();

// Test output should be assertions, not application logs. An individual test
// that cares about logging can raise the level itself.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.LOG_FORMAT = 'json';
