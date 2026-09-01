import PaymentTransaction from '../models/paymentTransaction.model.js';
import WebhookEvent from '../models/webhookEvent.model.js';
import {
  verifyPaystackSignature,
  verifyStripeSignature,
} from '../lib/webhookSignatures.js';
import {
  confirmOrderPayment,
  toMinorUnits,
  RESULT,
} from '../lib/paymentConfirmation.js';

/**
 * Gateway webhooks — the authoritative source of payment state.
 *
 * Before this existed, a payment was only recorded if the customer's browser
 * made it back to the verify callback. A closed tab meant the money arrived at
 * the gateway and the order stayed 'pending' forever, invisible to every
 * revenue report (finding F-01).
 *
 * Response contract, which is what stops gateways retrying forever:
 *   401 — signature invalid or missing. Do not retry; fix the configuration.
 *   400 — body is not parseable JSON.
 *   200 — received. Includes events we deliberately ignore, unknown references,
 *         and amount mismatches: none of those improve on redelivery.
 *   500 — genuine server fault. Retry is welcome.
 */

const parseRawBody = (req) => {
  // express.raw() leaves a Buffer on req.body. If some other parser reached the
  // route first, the raw bytes are gone and the signature cannot be checked —
  // fail closed rather than trusting an unverifiable payload.
  if (!Buffer.isBuffer(req.body)) return null;
  try {
    return JSON.parse(req.body.toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * Claim this event before doing any work. Returns false when another delivery
 * already claimed it, which makes the whole handler idempotent regardless of
 * how the gateway retries.
 */
const claimEvent = async ({ gateway, eventId, eventType, reference, payload }) => {
  try {
    return await WebhookEvent.create({
      gateway,
      eventId,
      eventType,
      reference,
      payload,
    });
  } catch (error) {
    if (error?.code === 11000) return null; // duplicate (gateway, eventId)
    throw error;
  }
};

const finish = async (eventDoc, outcome, order) => {
  if (!eventDoc) return;
  eventDoc.outcome = outcome;
  if (order) eventDoc.order = order._id;
  await eventDoc.save();
};

/** Shared tail: look up the transaction, reconcile, record the outcome. */
const applyPayment = async ({ res, gateway, eventDoc, reference, successful, paidMinor, currency, payload }) => {
  const transaction = await PaymentTransaction.findOne({ gatewayReference: reference });

  if (!transaction) {
    // Nothing to attach this to. Retrying will not conjure the transaction.
    console.warn(`[webhook:${gateway}] no transaction for reference ${reference}`);
    await finish(eventDoc, 'transaction_not_found', null);
    return res.status(200).json({ received: true, note: 'transaction not found' });
  }

  const { result, order, expectedMinor } = await confirmOrderPayment({
    transaction,
    successful,
    paidMinor,
    currency,
    gatewayResponse: payload,
    source: 'webhook',
  });

  if (result === RESULT.AMOUNT_MISMATCH || result === RESULT.CURRENCY_MISMATCH) {
    // Loud on purpose: this is either a partial settlement or someone probing.
    console.error(
      `[webhook:${gateway}] ${result} on ${reference}: settled ${paidMinor} ${currency}, expected ${expectedMinor}`
    );
  }

  await finish(eventDoc, result, order);
  return res.status(200).json({ received: true, result });
};

/* ---------------------------------------------------------------- Paystack */

export const handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('[webhook:paystack] PAYSTACK_SECRET_KEY is not configured');
      return res.status(500).json({ message: 'Webhook not configured' });
    }

    if (!verifyPaystackSignature(req.body, req.get('x-paystack-signature'), secret)) {
      console.warn('[webhook:paystack] signature verification failed');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const payload = parseRawBody(req);
    if (!payload) return res.status(400).json({ message: 'Invalid payload' });

    const { event, data } = payload;

    if (event !== 'charge.success') {
      return res.status(200).json({ received: true, ignored: event });
    }

    const reference = data?.reference;
    if (!reference) return res.status(200).json({ received: true, note: 'no reference' });

    const eventDoc = await claimEvent({
      gateway: 'paystack',
      eventId: String(data?.id ?? reference),
      eventType: event,
      reference,
      payload,
    });
    if (!eventDoc) return res.status(200).json({ received: true, duplicate: true });

    return await applyPayment({
      res,
      gateway: 'paystack',
      eventDoc,
      reference,
      successful: data?.status === 'success',
      paidMinor: toMinorUnits(data?.amount, { alreadyMinor: true }), // Paystack sends kobo
      currency: data?.currency,
      payload,
    });
  } catch (error) {
    console.error('[webhook:paystack] handler error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

/* ------------------------------------------------------------------ Stripe */

export const handleStripeWebhook = async (req, res) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[webhook:stripe] STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ message: 'Webhook not configured' });
    }

    if (!verifyStripeSignature(req.body, req.get('stripe-signature'), secret)) {
      console.warn('[webhook:stripe] signature verification failed');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const payload = parseRawBody(req);
    if (!payload) return res.status(400).json({ message: 'Invalid payload' });

    const eventType = payload?.type;

    if (eventType !== 'checkout.session.completed') {
      return res.status(200).json({ received: true, ignored: eventType });
    }

    const session = payload?.data?.object;
    const reference = session?.id;
    if (!reference) return res.status(200).json({ received: true, note: 'no reference' });

    const eventDoc = await claimEvent({
      gateway: 'stripe',
      eventId: String(payload?.id ?? reference),
      eventType,
      reference,
      payload,
    });
    if (!eventDoc) return res.status(200).json({ received: true, duplicate: true });

    return await applyPayment({
      res,
      gateway: 'stripe',
      eventDoc,
      reference,
      successful: session?.payment_status === 'paid',
      paidMinor: toMinorUnits(session?.amount_total, { alreadyMinor: true }), // Stripe sends minor units
      currency: session?.currency,
      payload,
    });
  } catch (error) {
    console.error('[webhook:stripe] handler error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};
