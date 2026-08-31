import crypto from 'crypto';

/**
 * Webhook signature verification for the payment gateways.
 *
 * Every function here takes the RAW request body as a Buffer. Signatures are
 * computed over the exact bytes the gateway sent: if the body has been parsed
 * and re-serialised by express.json(), key order and whitespace change and the
 * signature will never match. See index.js, where express.raw() is mounted on
 * /api/payments/webhooks ahead of the global JSON parser.
 */

/** Constant-time compare of two hex/ascii strings of possibly differing length. */
const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // timingSafeEqual throws on length mismatch, and the length itself is not a
  // secret, so compare lengths first and still run the constant-time check.
  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Paystack: HMAC-SHA512 of the raw body, keyed with the secret key,
 * delivered in the x-paystack-signature header.
 */
export const verifyPaystackSignature = (rawBody, signature, secret) => {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  return safeCompare(expected, signature);
};

/**
 * Stripe: the stripe-signature header carries a timestamp and one or more
 * v1 signatures, e.g. `t=1614556800,v1=abc...,v1=def...`. The signed payload
 * is `${timestamp}.${rawBody}`, HMAC-SHA256 with the endpoint secret.
 *
 * The timestamp is checked against a tolerance window so a captured request
 * cannot be replayed indefinitely.
 */
export const verifyStripeSignature = (
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = 300
) => {
  if (!Buffer.isBuffer(rawBody) || !signatureHeader || !secret) return false;

  const parts = signatureHeader.split(',').reduce(
    (acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    },
    { timestamp: null, signatures: [] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const timestamp = Number(parts.timestamp);
  if (!Number.isFinite(timestamp)) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > toleranceSeconds) return false;

  const signedPayload = Buffer.concat([
    Buffer.from(`${parts.timestamp}.`, 'utf8'),
    rawBody,
  ]);

  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Stripe may send several v1 signatures during a secret rotation; any match wins.
  return parts.signatures.some((sig) => safeCompare(expected, sig));
};

export const __testing = { safeCompare };
