import dotenv from 'dotenv';

// Load env vars before anything else in non-production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './lib/db.js';
import { logger } from './lib/logger.js';

const PORT = process.env.PORT || 5000;

// Start server — the database has to be up before we accept traffic. If it is
// not, exit non-zero so the platform reports a failed deploy instead of running
// a process that 500s every request.
const startServer = async () => {
  try {
    await connectDB();
  } catch (err) {
    logger.fatal({ err }, 'Could not connect to the database — refusing to start');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server listening');
  });

  const shutdown = (signal) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      await mongoose.connection.close(false).catch(() => {});
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Don't let an in-flight request that never finishes hold the deploy open.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A rejection nobody handled has left the process in an unknown state. Log it
  // with its stack rather than letting Node print a bare warning.
  process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, 'Unhandled promise rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
};

startServer();
