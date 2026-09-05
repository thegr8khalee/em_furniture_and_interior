import dotenv from 'dotenv';
import mongoose from 'mongoose';

// The suite talks to a real database, and which one is a local decision that
// belongs in .env alongside every other connection string. Jest does not load
// it, so this does — without overriding anything already in the environment,
// which is how CI points the same suite at its own server.
dotenv.config();

// Test output should be assertions, not application logs. An individual test
// that cares about logging can raise the level itself.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.LOG_FORMAT = 'json';

// The collections still on Mongo — notifications, the loyalty history, activity
// and audit logs — are written from paths these tests drive, and there is no
// Mongo here. Mongoose buffers such a write for ten seconds before rejecting,
// which turns every checkout in the suite into a ten-second wait for an error
// the handler already catches and logs. One millisecond gets the same failure
// immediately. Nothing about the application changes; when those collections
// move to PostgreSQL this line goes with them.
mongoose.set('bufferTimeoutMS', 1);
