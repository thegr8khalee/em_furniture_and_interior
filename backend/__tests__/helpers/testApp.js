import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import paymentRoutes from '../../src/routes/payments.routes.js';

/**
 * Builds an Express app that mirrors index.js for the payment routes,
 * including the ordering of body parsers — which is load-bearing. The raw
 * parser must sit ahead of express.json() or webhook signatures cannot be
 * verified, so the tests exercise the real arrangement rather than a
 * convenient one.
 */
export const buildTestApp = () => {
  const app = express();

  app.use('/api/payments/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // index.js also mounts a 50 MB parser on /api/payments for base64 uploads.
  // Included here because it sits between the global parser and the routes, and
  // a webhook must still reach the handler with its raw bytes intact.
  app.use('/api/payments', express.json({ limit: '50mb' }));
  app.use('/api/payments', express.urlencoded({ limit: '50mb', extended: true }));

  app.use('/api/payments', paymentRoutes);

  return app;
};

let mongoServer;

export const connectTestDb = async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'test' });
};

export const closeTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};

export const clearCollections = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
};
