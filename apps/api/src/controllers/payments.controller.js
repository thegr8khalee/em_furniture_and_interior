import { resolveOwner } from '../lib/owner.js';
import { CartError, clearCart } from '../services/cart.js';
import { cloudinaryStore } from '../services/imageStore.js';
import { logger } from '../lib/logger.js';
import {
  PaymentError,
  applyPaystackCharge,
  beginPaystackCheckout,
  fetchPaystackCharge,
  recordBankTransferProof,
  verifyPaystackSignature,
} from '../services/payments.js';

/*
 * Paystack, and proof of a bank transfer. The gateway calls, the idempotent
 * claim and everything the database sees are in services/payments.js; these
 * handlers translate the request and translate the error.
 */

const fail = (error, res, where) => {
  if (error instanceof PaymentError || error instanceof CartError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const initializePaystackPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'Order ID is required' });

    const owner = await resolveOwner(req);
    const checkout = await beginPaystackCheckout(owner, orderId, {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, ...checkout });
  } catch (error) {
    fail(error, res, 'Paystack initialize error');
  }
};

/**
 * A charge that has just been applied leaves a basket that has been bought.
 *
 * Outside the payment's transaction on purpose: the order is paid either way,
 * and a cart that fails to empty is a nuisance, not a reason to refuse a
 * gateway's confirmation and have it retried for days.
 */
const emptyTheBasket = async (customerId) => {
  if (!customerId) return;

  await clearCart({ customerId, guestSessionId: null }).catch((error) =>
    logger.error({ err: error }, 'Could not clear the cart after payment')
  );
};

/**
 * GET /api/payments/paystack/verify
 *
 * The fast path: the customer lands back on the site and we confirm immediately
 * rather than waiting for the webhook. The webhook remains the source of truth
 * for anyone who closes the tab, so this endpoint is an optimisation, not the
 * only route to a confirmed order.
 */
export const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: 'Payment reference is required' });

    const charge = await fetchPaystackCharge(reference);
    const result = await applyPaystackCharge(charge, 'redirect');

    if (result.outcome === 'unknown_reference' || result.outcome === 'no_reference') {
      return res.status(404).json({ message: 'Payment transaction not found' });
    }

    if (result.outcome === 'amount_mismatch') {
      return res.status(409).json({
        message:
          'The amount received does not match this order. Your payment is safe — please contact support.',
        status: 'mismatch',
      });
    }

    if (result.outcome === 'applied') await emptyTheBasket(result.customerId);

    const paid = result.outcome === 'applied' || result.outcome === 'already_applied';

    res.json({
      success: true,
      status: paid ? 'success' : 'failed',
      orderId: result.transaction?.order_id,
      orderNumber: result.transaction?.order_number,
      amount: result.transaction?.amount,
    });
  } catch (error) {
    fail(error, res, 'Paystack verification error');
  }
};

/**
 * POST /api/payments/paystack/webhook
 *
 * Mounted in app.js ahead of every body parser, because the HMAC covers the
 * exact bytes Paystack sent — a re-serialised JSON object will not match.
 */
export const handlePaystackWebhook = async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    logger.error(
      'Paystack webhook: body is not raw — the route must be mounted with express.raw() before any JSON parser'
    );
    return res.status(500).json({ message: 'Webhook misconfigured' });
  }

  if (!verifyPaystackSignature(req.body, req.get('x-paystack-signature'))) {
    logger.warn({ ip: req.ip }, 'Paystack webhook: rejected unsigned or mis-signed request');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Malformed webhook payload' });
  }

  try {
    if (event?.event === 'charge.success') {
      const result = await applyPaystackCharge(event.data, 'webhook');
      if (result.outcome === 'applied') await emptyTheBasket(result.customerId);
    }
    // Every other event type is acknowledged and ignored: replying non-2xx
    // makes Paystack retry for days over something we were never going to act on.
    return res.sendStatus(200);
  } catch (error) {
    // A genuine failure (database down mid-charge) SHOULD retry, so fail loudly.
    logger.error({ err: error }, 'Paystack webhook processing error');
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

export const uploadBankTransferProof = async (req, res) => {
  try {
    const { orderId, proofData, bankName, transferDate, transferReference } = req.body;

    if (!orderId) return res.status(400).json({ message: 'Order ID is required' });
    if (!proofData) return res.status(400).json({ message: 'Proof of payment is required' });

    const owner = await resolveOwner(req);
    const { url } = await cloudinaryStore.upload(proofData, 'bank_transfers');

    const { transactionId, proofUrl } = await recordBankTransferProof(owner, {
      orderId,
      proofUrl: url,
      bankName,
      transferDate,
      transferReference,
    });

    res.json({
      success: true,
      message: 'Bank transfer proof uploaded successfully',
      transactionId,
      proofUrl,
    });
  } catch (error) {
    fail(error, res, 'Bank transfer proof upload error');
  }
};
