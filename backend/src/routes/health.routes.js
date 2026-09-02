import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

/**
 * Liveness. Answers "is this process alive and turning its event loop?" and
 * deliberately never touches the database — restarting the container because
 * Mongo blipped turns a database incident into an outage.
 */
router.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

/**
 * Readiness. Answers "can this instance actually serve a request?" — so it does
 * touch the database. A 503 tells the load balancer to drain this instance
 * rather than send it traffic that is going to 500.
 */
router.get('/readyz', async (req, res) => {
  const state = CONNECTION_STATES[mongoose.connection.readyState] || 'unknown';

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'unavailable', database: state });
  }

  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ok', database: state });
  } catch (error) {
    req.log?.error({ err: error }, 'Readiness check failed to ping the database');
    res.status(503).json({ status: 'unavailable', database: state });
  }
});

export default router;
