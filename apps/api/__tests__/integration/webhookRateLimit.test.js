import express from 'express';
import request from 'supertest';
import { apiLimiter } from '../../src/middleware/rateLimiter.js';

/**
 * The global /api limiter must not apply to gateway webhooks. This asserts the
 * exemption in src/index.js works as written — req.path inside an app.use mount
 * is relative to the mount point, which is easy to get wrong.
 */
describe('webhook rate-limit exemption', () => {
  const build = () => {
    const app = express();
    app.use('/api', (req, res, next) =>
      req.path.startsWith('/payments/webhooks') ? next() : apiLimiter(req, res, next)
    );
    app.post('/api/payments/webhooks/paystack', (req, res) => res.json({ ok: true }));
    app.get('/api/products', (req, res) => res.json({ ok: true }));
    return app;
  };

  test('webhook path is exempt from the limiter', async () => {
    const app = build();
    const res = await request(app).post('/api/payments/webhooks/paystack');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });

  test('ordinary API paths are still rate limited', async () => {
    const app = build();
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
