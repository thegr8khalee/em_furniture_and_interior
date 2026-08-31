import { jest } from '@jest/globals';
import request from 'supertest';
import Order from '../../src/models/order.model.js';
import PaymentTransaction from '../../src/models/paymentTransaction.model.js';
import WebhookEvent from '../../src/models/webhookEvent.model.js';
import {
  buildTestApp,
  connectTestDb,
  closeTestDb,
  clearCollections,
} from '../helpers/testApp.js';
import {
  createPendingPayment,
  paystackBody,
  paystackSignature,
  flutterwaveBody,
  stripeBody,
  stripeSignature,
  PAYSTACK_SECRET,
  FLUTTERWAVE_HASH,
  STRIPE_SECRET,
} from '../helpers/paymentFixtures.js';

/**
 * Integration tests for the gateway webhooks (findings F-01 and F-09).
 * These run against a real Express app and a real MongoDB — no mocked models,
 * no mocked request pipeline.
 */

let app;

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
  process.env.FLUTTERWAVE_WEBHOOK_HASH = FLUTTERWAVE_HASH;
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
  await connectTestDb();
  app = buildTestApp();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await clearCollections();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Send the exact bytes the gateway would. superagent JSON-encodes a Buffer
// into {"type":"Buffer","data":[...]} when the content type is JSON, which
// changes the payload and breaks every signature — so pass the string through.
const postWebhook = (path, rawBody, headers = {}) =>
  request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .set(headers)
    .send(rawBody);

describe('Paystack webhook', () => {
  const PATH = '/api/payments/webhooks/paystack';

  test('confirms an order when the signature and amount are correct', async () => {
    const { order } = await createPendingPayment({ totalAmount: 150000, reference: 'PS-1' });
    const body = paystackBody({ reference: 'PS-1', amountKobo: 15000000 });

    const res = await postWebhook(PATH, body, { 'x-paystack-signature': paystackSignature(body) });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('confirmed');

    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.status).toBe('confirmed');
  });

  test('rejects a tampered payload with 401 and leaves the order unpaid', async () => {
    const { order } = await createPendingPayment({ reference: 'PS-2' });
    const body = paystackBody({ reference: 'PS-2', amountKobo: 15000000 });
    const signature = paystackSignature(body);
    const tampered = paystackBody({ reference: 'PS-2', amountKobo: 1 });

    const res = await postWebhook(PATH, tampered, { 'x-paystack-signature': signature });

    expect(res.status).toBe(401);
    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('pending');
  });

  test('rejects a missing signature with 401', async () => {
    await createPendingPayment({ reference: 'PS-3' });
    const body = paystackBody({ reference: 'PS-3', amountKobo: 15000000 });

    const res = await postWebhook(PATH, body);

    expect(res.status).toBe(401);
  });

  // Finding F-09: a gateway saying "success" is not enough on its own.
  test('does NOT mark paid when the settled amount is short', async () => {
    const { order, transaction } = await createPendingPayment({
      totalAmount: 150000,
      reference: 'PS-4',
    });
    const body = paystackBody({ reference: 'PS-4', amountKobo: 100 }); // ₦1 against ₦150,000

    const res = await postWebhook(PATH, body, { 'x-paystack-signature': paystackSignature(body) });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('amount_mismatch');

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.paymentStatus).toBe('pending');

    const updatedTx = await PaymentTransaction.findById(transaction._id);
    expect(updatedTx.status).toBe('failed');
    expect(updatedTx.verified).toBe(false);
    expect(updatedTx.verificationNotes).toMatch(/Amount mismatch/);
  });

  // Gateways redeliver until they see a 2xx, and sometimes after.
  test('is idempotent across redelivery of the same event', async () => {
    const { order } = await createPendingPayment({ totalAmount: 150000, reference: 'PS-5' });
    const body = paystackBody({ reference: 'PS-5', amountKobo: 15000000, id: 777 });
    const headers = { 'x-paystack-signature': paystackSignature(body) };

    const first = await postWebhook(PATH, body, headers);
    const second = await postWebhook(PATH, body, headers);

    expect(first.body.result).toBe('confirmed');
    expect(second.body.duplicate).toBe(true);

    expect(await WebhookEvent.countDocuments({ gateway: 'paystack' })).toBe(1);
    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('paid');
  });

  test('acknowledges unrelated event types without touching orders', async () => {
    const body = JSON.stringify({ event: 'transfer.success', data: { id: 5 } });

    const res = await postWebhook(PATH, body, { 'x-paystack-signature': paystackSignature(body) });

    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe('transfer.success');
  });

  test('acknowledges an unknown reference rather than asking for a retry', async () => {
    const body = paystackBody({ reference: 'DOES-NOT-EXIST', amountKobo: 100 });

    const res = await postWebhook(PATH, body, { 'x-paystack-signature': paystackSignature(body) });

    expect(res.status).toBe(200);
    expect(res.body.note).toBe('transaction not found');
  });

  test('marks the transaction failed when the gateway reports failure', async () => {
    const { order, transaction } = await createPendingPayment({ reference: 'PS-6' });
    const body = paystackBody({ reference: 'PS-6', amountKobo: 15000000, status: 'failed' });

    const res = await postWebhook(PATH, body, { 'x-paystack-signature': paystackSignature(body) });

    expect(res.body.result).toBe('failed');
    expect((await Order.findById(order._id)).paymentStatus).toBe('pending');
    expect((await PaymentTransaction.findById(transaction._id)).status).toBe('failed');
  });
});

describe('Flutterwave webhook', () => {
  const PATH = '/api/payments/webhooks/flutterwave';

  test('confirms on a matching hash and amount in major units', async () => {
    const { order } = await createPendingPayment({
      totalAmount: 150000,
      gateway: 'flutterwave',
      reference: 'FLW-1',
    });
    const body = flutterwaveBody({ reference: 'FLW-1', amount: 150000 });

    const res = await postWebhook(PATH, body, { 'verif-hash': FLUTTERWAVE_HASH });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('confirmed');
    expect((await Order.findById(order._id)).paymentStatus).toBe('paid');
  });

  test('rejects a wrong verif-hash with 401', async () => {
    const { order } = await createPendingPayment({ gateway: 'flutterwave', reference: 'FLW-2' });
    const body = flutterwaveBody({ reference: 'FLW-2', amount: 150000 });

    const res = await postWebhook(PATH, body, { 'verif-hash': 'wrong-hash' });

    expect(res.status).toBe(401);
    expect((await Order.findById(order._id)).paymentStatus).toBe('pending');
  });

  test('does not confuse major and minor units', async () => {
    const { order } = await createPendingPayment({
      totalAmount: 150000,
      gateway: 'flutterwave',
      reference: 'FLW-3',
    });
    // 15,000,000 would be correct for Paystack (kobo) but is 100x too much here.
    const body = flutterwaveBody({ reference: 'FLW-3', amount: 15000000 });

    const res = await postWebhook(PATH, body, { 'verif-hash': FLUTTERWAVE_HASH });

    expect(res.body.result).toBe('amount_mismatch');
    expect((await Order.findById(order._id)).paymentStatus).toBe('pending');
  });
});

describe('Stripe webhook', () => {
  const PATH = '/api/payments/webhooks/stripe';

  test('confirms on a valid signature and amount', async () => {
    const { order } = await createPendingPayment({
      totalAmount: 150000,
      gateway: 'stripe',
      reference: 'cs_test_1',
    });
    const body = stripeBody({ reference: 'cs_test_1', amountMinor: 15000000 });

    const res = await postWebhook(PATH, body, { 'stripe-signature': stripeSignature(body) });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('confirmed');
    expect((await Order.findById(order._id)).paymentStatus).toBe('paid');
  });

  test('rejects a replayed signature outside the tolerance window', async () => {
    const { order } = await createPendingPayment({ gateway: 'stripe', reference: 'cs_test_2' });
    const body = stripeBody({ reference: 'cs_test_2', amountMinor: 15000000 });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600;

    const res = await postWebhook(PATH, body, {
      'stripe-signature': stripeSignature(body, STRIPE_SECRET, staleTimestamp),
    });

    expect(res.status).toBe(401);
    expect((await Order.findById(order._id)).paymentStatus).toBe('pending');
  });

  test('rejects a malformed signature header with 401', async () => {
    await createPendingPayment({ gateway: 'stripe', reference: 'cs_test_3' });
    const body = stripeBody({ reference: 'cs_test_3', amountMinor: 15000000 });

    const res = await postWebhook(PATH, body, { 'stripe-signature': 'garbage' });

    expect(res.status).toBe(401);
  });
});
