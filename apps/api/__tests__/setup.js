// Test output should be assertions, not application logs. An individual test
// that cares about logging can raise the level itself.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.LOG_FORMAT = 'json';
