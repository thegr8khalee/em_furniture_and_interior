import crypto from 'crypto';
import {
  verifyPaystackSignature,
  verifyStripeSignature,
} from '../../src/lib/webhookSignatures.js';
import { toMinorUnits } from '../../src/lib/paymentConfirmation.js';

const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { id: 1 } }));

describe('verifyPaystackSignature', () => {
  const secret = 'sk_test_secret';
  const sign = (b, s = secret) => crypto.createHmac('sha512', s).update(b).digest('hex');

  test('accepts a signature produced with the same secret and body', () => {
    expect(verifyPaystackSignature(body, sign(body), secret)).toBe(true);
  });

  test('rejects a signature produced with a different secret', () => {
    expect(verifyPaystackSignature(body, sign(body, 'other'), secret)).toBe(false);
  });

  test('rejects when a single byte of the body changed', () => {
    const altered = Buffer.from(body.toString().replace('"id":1', '"id":2'));
    expect(verifyPaystackSignature(altered, sign(body), secret)).toBe(false);
  });

  test('rejects missing signature, missing secret, or a non-Buffer body', () => {
    expect(verifyPaystackSignature(body, undefined, secret)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyPaystackSignature(body.toString(), sign(body), secret)).toBe(false);
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test';
  const header = (b, ts = Math.floor(Date.now() / 1000), s = secret) => {
    const sig = crypto.createHmac('sha256', s).update(`${ts}.${b}`).digest('hex');
    return `t=${ts},v1=${sig}`;
  };

  test('accepts a current, correctly signed payload', () => {
    expect(verifyStripeSignature(body, header(body), secret)).toBe(true);
  });

  test('rejects a timestamp outside the tolerance window', () => {
    const stale = Math.floor(Date.now() / 1000) - 400;
    expect(verifyStripeSignature(body, header(body, stale), secret, 300)).toBe(false);
  });

  test('accepts a timestamp inside the tolerance window', () => {
    const recent = Math.floor(Date.now() / 1000) - 100;
    expect(verifyStripeSignature(body, header(body, recent), secret, 300)).toBe(true);
  });

  test('accepts when one of several v1 signatures matches, as during rotation', () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(verifyStripeSignature(body, `t=${ts},v1=deadbeef,v1=${good}`, secret)).toBe(true);
  });

  test('rejects malformed headers', () => {
    expect(verifyStripeSignature(body, 'garbage', secret)).toBe(false);
    expect(verifyStripeSignature(body, 't=abc,v1=xyz', secret)).toBe(false);
    expect(verifyStripeSignature(body, `t=${Math.floor(Date.now() / 1000)}`, secret)).toBe(false);
  });
});

// Guards the conversion a gateway integration depends on: reading a major-unit
// amount as minor units silently under-charges by 100x.
describe('toMinorUnits', () => {
  test('converts major units to minor', () => {
    expect(toMinorUnits(150000)).toBe(15000000);
    expect(toMinorUnits(1500.5)).toBe(150050);
  });

  test('passes through values already in minor units', () => {
    expect(toMinorUnits(15000000, { alreadyMinor: true })).toBe(15000000);
  });

  test('rounds rather than truncating float artefacts', () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });

  test('returns null for values that are not finite numbers', () => {
    expect(toMinorUnits(undefined)).toBeNull();
    expect(toMinorUnits('abc')).toBeNull();
    expect(toMinorUnits(NaN)).toBeNull();
  });
});
