import crypto from 'crypto';
import request from 'supertest';

// The app must build and answer without a database connection — these tests
// cover exactly the paths that run before Mongo is reached.
process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_secret';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.LOG_LEVEL = 'silent';

const { default: app } = await import('../../src/app.js');

const sign = (raw, secret = process.env.PAYSTACK_SECRET_KEY) =>
  crypto.createHmac('sha512', secret).update(raw).digest('hex');

describe('Health and readiness probes', () => {
  test('GET /healthz reports liveness without touching the database', async () => {
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET /readyz reports 503 while the database is unreachable', async () => {
    // This is the point of splitting readiness from liveness: a load balancer
    // drains the instance instead of restarting a process that is fine.
    const res = await request(app).get('/readyz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unavailable');
    expect(res.body.database).not.toBe('connected');
  });

  test('probes sit outside /api so the API rate limiter cannot throttle them', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, () => request(app).get('/healthz'))
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
  });
});

describe('Request correlation', () => {
  test('every response carries an x-request-id', async () => {
    const res = await request(app).get('/healthz');

    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('a caller-supplied x-request-id is echoed back so a trace can span services', async () => {
    const res = await request(app).get('/healthz').set('x-request-id', 'web-abc-123');

    expect(res.headers['x-request-id']).toBe('web-abc-123');
  });

  test('a hostile x-request-id is replaced rather than trusted', async () => {
    const hostile = 'a'.repeat(500);
    const res = await request(app).get('/healthz').set('x-request-id', hostile);

    expect(res.headers['x-request-id']).not.toBe(hostile);
    expect(res.headers['x-request-id'].length).toBeLessThanOrEqual(64);
  });

  test('ids differ between requests', async () => {
    const [a, b] = await Promise.all([request(app).get('/healthz'), request(app).get('/healthz')]);

    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });
});

describe('Paystack webhook over HTTP', () => {
  const body = JSON.stringify({
    event: 'charge.success',
    data: { reference: 'EM-TEST-1', status: 'success', amount: 150000, currency: 'NGN' },
  });

  test('rejects a request with no signature', async () => {
    const res = await request(app)
      .post('/api/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
  });

  test('rejects a forged signature of the right length', async () => {
    const res = await request(app)
      .post('/api/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'a'.repeat(128))
      .send(body);

    expect(res.status).toBe(401);
  });

  test('rejects a junk-length signature without a 500', async () => {
    // A short header would throw inside crypto.timingSafeEqual without the
    // length guard, turning every malformed request into a server error.
    const res = await request(app)
      .post('/api/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'junk')
      .send(body);

    expect(res.status).toBe(401);
  });

  test('rejects a body tampered with after signing', async () => {
    const tampered = body.replace('150000', '1');
    const res = await request(app)
      .post('/api/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(body))
      .send(tampered);

    expect(res.status).toBe(401);
  });

  test('a valid signature over non-JSON reaches the parser, proving the raw body survived', async () => {
    // The decisive check on middleware order: if any JSON parser had touched
    // the body before the verifier, the HMAC could not have matched at all.
    const raw = 'not-json-at-all';
    const res = await request(app)
      .post('/api/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/malformed/i);
  });
});

describe('Removed payment gateways', () => {
  test.each([
    ['post', '/api/payments/flutterwave/initialize'],
    ['get', '/api/payments/flutterwave/verify'],
    ['post', '/api/payments/stripe/initialize'],
    ['get', '/api/payments/stripe/verify'],
  ])('%s %s is gone', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(404);
  });

  test('the Paystack verify route is still mounted', async () => {
    const res = await request(app).get('/api/payments/paystack/verify');

    // 400 rather than 404: routed to the handler, which rejects the missing reference.
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reference is required/i);
  });
});
