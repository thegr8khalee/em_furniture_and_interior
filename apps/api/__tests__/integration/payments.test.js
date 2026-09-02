import { jest } from '@jest/globals';
import crypto from 'crypto';
import { calculateTax } from '../../src/controllers/tax.controller.js';
import {
  verifyPaystackSignature,
  chargeMatchesOrder,
  toMinorUnit,
} from '../../src/controllers/payments.controller.js';

const WEBHOOK_SECRET = 'sk_test_paystack_secret';

process.env.PAYSTACK_SECRET_KEY = WEBHOOK_SECRET;
process.env.TAX_RATE_PERCENTAGE = '7.5';
process.env.FRONTEND_URL = 'http://localhost:5173';

/** Signs a payload the way Paystack does, so the tests exercise the real path. */
const sign = (rawBody, secret = WEBHOOK_SECRET) =>
  crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

const chargePayload = (overrides = {}) =>
  Buffer.from(
    JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'EM-ORD-12345678-001-1700000000000',
        status: 'success',
        amount: 150000,
        currency: 'NGN',
        ...overrides,
      },
    })
  );

describe('Paystack webhook signature verification', () => {
  test('accepts a body signed with the configured secret', () => {
    const body = chargePayload();
    expect(verifyPaystackSignature(body, sign(body))).toBe(true);
  });

  test('accepts the Buffer that express.raw() delivers', () => {
    const body = chargePayload();
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(verifyPaystackSignature(body, sign(body))).toBe(true);
  });

  test('rejects a body tampered with after signing', () => {
    const original = chargePayload();
    const signature = sign(original);
    // An attacker inflating the amount on a payload they intercepted.
    const tampered = chargePayload({ amount: 1 });

    expect(verifyPaystackSignature(tampered, signature)).toBe(false);
  });

  test('rejects a signature produced with a different secret', () => {
    const body = chargePayload();
    expect(verifyPaystackSignature(body, sign(body, 'sk_test_wrong_secret'))).toBe(false);
  });

  test('rejects a forged signature of the correct length', () => {
    const body = chargePayload();
    const forged = 'a'.repeat(sign(body).length);

    expect(verifyPaystackSignature(body, forged)).toBe(false);
  });

  test('rejects a signature of the wrong length without throwing', () => {
    const body = chargePayload();
    // crypto.timingSafeEqual throws on length mismatch — the length guard in the
    // implementation is what stops this becoming a 500 on every junk request.
    expect(() => verifyPaystackSignature(body, 'too-short')).not.toThrow();
    expect(verifyPaystackSignature(body, 'too-short')).toBe(false);
  });

  test('rejects a missing signature header', () => {
    const body = chargePayload();
    expect(verifyPaystackSignature(body, undefined)).toBe(false);
    expect(verifyPaystackSignature(body, '')).toBe(false);
  });

  test('rejects everything when PAYSTACK_SECRET_KEY is missing', () => {
    // A deploy without the key must reject every webhook, never accept them.
    const body = chargePayload();
    const signature = sign(body);
    const configured = process.env.PAYSTACK_SECRET_KEY;

    delete process.env.PAYSTACK_SECRET_KEY;
    try {
      expect(verifyPaystackSignature(body, signature)).toBe(false);
    } finally {
      process.env.PAYSTACK_SECRET_KEY = configured;
    }

    expect(verifyPaystackSignature(body, signature, '')).toBe(false);
  });

  test('is sensitive to whitespace, so a re-serialised body will not verify', () => {
    const body = chargePayload();
    const signature = sign(body);
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(body.toString()), null, 2));

    expect(verifyPaystackSignature(reserialised, signature)).toBe(false);
  });
});

describe('Charge amount verification', () => {
  test('converts naira to kobo', () => {
    expect(toMinorUnit(1500)).toBe(150000);
    expect(toMinorUnit(0)).toBe(0);
  });

  test('converts fractional amounts without floating-point drift', () => {
    expect(toMinorUnit(19.99)).toBe(1999);
    expect(toMinorUnit(1234.56)).toBe(123456);
    expect(toMinorUnit(0.1 + 0.2)).toBe(30);
  });

  test('accepts a charge matching the order total exactly', () => {
    expect(chargeMatchesOrder({ amount: 150000, currency: 'NGN' }, { totalAmount: 1500 })).toBe(true);
  });

  test('rejects an underpayment', () => {
    expect(chargeMatchesOrder({ amount: 100, currency: 'NGN' }, { totalAmount: 1500 })).toBe(false);
  });

  test('rejects an overpayment', () => {
    expect(chargeMatchesOrder({ amount: 999999, currency: 'NGN' }, { totalAmount: 1500 })).toBe(false);
  });

  test('rejects a charge in the wrong currency', () => {
    expect(chargeMatchesOrder({ amount: 150000, currency: 'USD' }, { totalAmount: 1500 })).toBe(false);
  });

  test('accepts the currency code in any case', () => {
    expect(chargeMatchesOrder({ amount: 150000, currency: 'ngn' }, { totalAmount: 1500 })).toBe(true);
  });

  test('rejects a malformed charge', () => {
    expect(chargeMatchesOrder({}, { totalAmount: 1500 })).toBe(false);
    expect(chargeMatchesOrder({ amount: null, currency: 'NGN' }, { totalAmount: 1500 })).toBe(false);
    expect(chargeMatchesOrder({ amount: 150000, currency: 'NGN' }, {})).toBe(false);
  });

  test('matches on a total with kobo precision', () => {
    expect(chargeMatchesOrder({ amount: 123456, currency: 'NGN' }, { totalAmount: 1234.56 })).toBe(true);
    expect(chargeMatchesOrder({ amount: 123455, currency: 'NGN' }, { totalAmount: 1234.56 })).toBe(false);
  });
});

describe('Tax calculation', () => {
  beforeEach(() => {
    process.env.TAX_RATE_PERCENTAGE = '10';
  });

  test('calculates tax from the configured percentage', async () => {
    const req = {
      body: {
        items: [{ id: 'prod1', quantity: 1, price: 1000 }],
        amount: 1000,
        currency: 'NGN',
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await calculateTax(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        tax: expect.objectContaining({
          amountToCollect: 100,
          rate: 0.1,
          taxableAmount: 1000,
        }),
        currency: 'NGN',
      })
    );
  });

  test('rejects a request with no items', async () => {
    const req = { body: { amount: 1000 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await calculateTax(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/items are required/i) })
    );
  });
});
