import express from 'express';
import { databaseIsReachable } from '../lib/db.js';

const router = express.Router();

/**
 * Liveness. Answers "is this process alive and turning its event loop?" and
 * deliberately never touches the database — restarting the container because
 * the database blipped turns a database incident into an outage.
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
  if (await databaseIsReachable()) {
    return res.json({ status: 'ok', database: 'connected' });
  }

  res.status(503).json({ status: 'unavailable', database: 'disconnected' });
});

/**
 * Root service status response. Gives an immediate signal when navigating
 * to the API URL in a browser that the deployment is alive and reachable.
 */
const serviceInfo = (req, res) => {
  res.json({
    name: 'EM Furniture & Interior API',
    status: 'online',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()),
    endpoints: {
      health: '/healthz',
      readiness: '/readyz',
      documentation: '/api-docs',
    },
  });
};

router.get('/', serviceInfo);
router.get('/api', serviceInfo);

export default router;
