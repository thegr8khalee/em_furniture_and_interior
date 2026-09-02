import crypto from 'crypto';
import Order from '../models/order.model.js';
import PaymentTransaction from '../models/paymentTransaction.model.js';
import GuestSession from '../models/guest.model.js';
import User from '../models/user.model.js';
import cloudinary from '../lib/cloudinary.js';
import { logger } from '../lib/logger.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_CURRENCY = 'NGN';

const getPaystackSecret = () => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  return secretKey;
};

const getPaystackHeaders = () => ({
  Authorization: `Bearer ${getPaystackSecret()}`,
  'Content-Type': 'application/json',
});

/** Paystack works in the currency's minor unit (kobo for NGN). */
export const toMinorUnit = (amount) => Math.round(Number(amount) * 100);

/**
 * Paystack signs the raw request body with HMAC-SHA512 keyed on the secret key.
 * Compared in constant time so a wrong signature can't be narrowed down by
 * timing the response.
 */
export const verifyPaystackSignature = (
  rawBody,
  signature,
  secret = process.env.PAYSTACK_SECRET_KEY
) => {
  if (!secret || !signature || rawBody == null) {
    return false;
  }

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  const provided = String(signature);

  // timingSafeEqual throws on length mismatch, so length is checked first. The
  // digest length is fixed and public, so this leaks nothing useful.
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(provided, 'utf8')
  );
};

/**
 * The gateway's reported amount must match what we asked it to charge. Without
 * this, a caller who can influence the charge (or a replayed event from a
 * different order) could mark an order paid for the wrong sum.
 */
export const chargeMatchesOrder = (charge, order) =>
  Number(charge?.amount) === toMinorUnit(order?.totalAmount) &&
  String(charge?.currency).toUpperCase() === PAYSTACK_CURRENCY;

const resolveOrderForRequester = async (req, orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    return { error: 'Order not found' };
  }

  if (req.user) {
    if (!order.user || order.user.toString() !== req.user._id.toString()) {
      return { error: 'Not authorized for this order' };
    }
    return { order };
  }

  if (req.guestSession) {
    const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });
    if (!guestSession || !order.guest || order.guest.toString() !== guestSession._id.toString()) {
      return { error: 'Not authorized for this order' };
    }
    return { order };
  }

  return { error: 'Authentication required' };
};

const clearRequesterCart = async (order) => {
  if (order.user) {
    await User.findByIdAndUpdate(order.user, { cart: [] });
  } else if (order.guest) {
    await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
  }
};

/**
 * Marks a transaction and its order as paid.
 *
 * Both the redirect callback and the webhook land here, often for the same
 * charge and sometimes at the same moment, so the transaction is claimed with a
 * conditional update — only the first caller through does the work, everyone
 * else gets `already_applied` and changes nothing.
 */
const applySuccessfulCharge = async (transaction, charge, source) => {
  const order = await Order.findById(transaction.order);
  if (!order) {
    logger.error(`Paystack ${source}: transaction ${transaction._id} points at missing order ${transaction.order}`);
    return { outcome: 'order_not_found' };
  }

  if (!chargeMatchesOrder(charge, order)) {
    await PaymentTransaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: 'failed',
          verified: false,
          gatewayResponse: charge,
          verificationNotes:
            `Amount/currency mismatch via ${source}: gateway reported ` +
            `${charge?.amount} ${charge?.currency}, order expects ` +
            `${toMinorUnit(order.totalAmount)} ${PAYSTACK_CURRENCY}`,
        },
      }
    );
    logger.error(`Paystack ${source}: REJECTED charge ${charge?.reference} for order ${order.orderNumber} — ` + `reported ${charge?.amount} ${charge?.currency}, expected ${toMinorUnit(order.totalAmount)} ${PAYSTACK_CURRENCY}`);
    return { outcome: 'amount_mismatch', order };
  }

  const claimed = await PaymentTransaction.findOneAndUpdate(
    { _id: transaction._id, status: { $ne: 'success' } },
    {
      $set: {
        status: 'success',
        verified: true,
        verifiedAt: new Date(),
        gatewayResponse: charge,
        verificationNotes: `Confirmed via ${source}`,
      },
    },
    { new: true }
  );

  if (!claimed) {
    return { outcome: 'already_applied', order };
  }

  // findOneAndUpdate skips the model's save hooks, so the status-history entry
  // the pre('save') hook would have written is pushed explicitly here.
  const update = { $set: { paymentStatus: 'paid', paymentMethod: 'paystack' } };
  if (order.status === 'pending') {
    update.$set.status = 'confirmed';
    update.$push = {
      statusHistory: {
        status: 'confirmed',
        timestamp: new Date(),
        note: `Payment confirmed via Paystack (${source})`,
      },
    };
  }

  await Order.updateOne({ _id: order._id }, update);
  await clearRequesterCart(order);

  logger.info(`Paystack ${source}: order ${order.orderNumber} marked paid (${charge.reference})`);

  return { outcome: 'applied', order };
};

const markChargeFailed = async (transaction, charge, source) => {
  await PaymentTransaction.updateOne(
    { _id: transaction._id, status: { $nin: ['success', 'refunded'] } },
    {
      $set: {
        status: 'failed',
        verified: false,
        gatewayResponse: charge,
        verificationNotes: `Gateway reported "${charge?.status}" via ${source}`,
      },
    }
  );
};

/**
 * Shared entry point for a Paystack charge payload, whichever path delivered it.
 */
const processPaystackCharge = async (charge, source) => {
  const reference = charge?.reference;
  if (!reference) {
    return { outcome: 'no_reference' };
  }

  const transaction = await PaymentTransaction.findOne({ gatewayReference: reference });
  if (!transaction) {
    // Not a reference we issued — another environment sharing the key, or a
    // charge created outside checkout. Nothing to reconcile.
    logger.warn(`Paystack ${source}: no transaction found for reference ${reference}`);
    return { outcome: 'unknown_reference' };
  }

  if (charge.status !== 'success') {
    await markChargeFailed(transaction, charge, source);
    return { outcome: 'not_successful', transaction };
  }

  const result = await applySuccessfulCharge(transaction, charge, source);
  return { ...result, transaction };
};

export const initializePaystackPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const { order, error } = await resolveOrderForRequester(req, orderId);
    if (error) {
      return res.status(403).json({ message: error });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    // Reuse an in-flight attempt so a customer who goes back and retries keeps
    // one reference — but only while it still bills the current order total.
    const pendingTransaction = await PaymentTransaction.findOne({
      order: order._id,
      paymentMethod: 'paystack',
      status: { $in: ['pending', 'processing'] },
    });

    if (
      pendingTransaction?.gatewayReference &&
      pendingTransaction.metadata?.authorizationUrl &&
      pendingTransaction.amount === order.totalAmount
    ) {
      return res.json({
        success: true,
        authorizationUrl: pendingTransaction.metadata.authorizationUrl,
        reference: pendingTransaction.gatewayReference,
        transactionId: pendingTransaction._id,
        orderId: order._id,
      });
    }

    let customerEmail = order?.shippingAddress?.email || order?.billingAddress?.email;

    if (!customerEmail && order.user) {
      const user = await User.findById(order.user);
      customerEmail = user?.email;
    }

    if (!customerEmail) {
      return res.status(400).json({ message: 'Customer email is required for payment' });
    }

    const reference = `EM-${order.orderNumber}-${Date.now()}`;
    const payload = {
      email: customerEmail,
      amount: toMinorUnit(order.totalAmount),
      currency: PAYSTACK_CURRENCY,
      reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/verify`,
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    };

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: getPaystackHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(400).json({
        message: data?.message || 'Failed to initialize Paystack payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      user: order.user || null,
      guest: order.guest || null,
      amount: order.totalAmount,
      currency: PAYSTACK_CURRENCY,
      paymentMethod: 'paystack',
      gateway: 'paystack',
      gatewayReference: reference,
      status: 'pending',
      metadata: {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        expectedAmountMinor: toMinorUnit(order.totalAmount),
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      reference,
      transactionId: transaction._id,
      orderId: order._id,
    });
  } catch (error) {
    logger.error({ err: error }, 'Paystack initialize error');
    res.status(500).json({ message: 'Failed to initialize payment' });
  }
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

    if (!reference) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET', headers: getPaystackHeaders() }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(400).json({
        message: data?.message || 'Failed to verify payment',
        error: data,
      });
    }

    const result = await processPaystackCharge(data.data, 'redirect');

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

    const paid = result.outcome === 'applied' || result.outcome === 'already_applied';

    res.json({
      success: true,
      status: paid ? 'success' : 'failed',
      orderId: result.order?._id,
      orderNumber: result.order?.orderNumber,
      amount: result.transaction?.amount,
    });
  } catch (error) {
    logger.error({ err: error }, 'Paystack verification error');
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

/**
 * POST /api/payments/paystack/webhook
 *
 * Mounted in index.js ahead of every body parser, because the HMAC covers the
 * exact bytes Paystack sent — a re-serialised JSON object will not match.
 */
export const handlePaystackWebhook = async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    logger.error('Paystack webhook: body is not raw — the route must be mounted with express.raw() before any JSON parser');
    return res.status(500).json({ message: 'Webhook misconfigured' });
  }

  if (!verifyPaystackSignature(req.body, req.get('x-paystack-signature'))) {
    logger.warn(`Paystack webhook: rejected unsigned or mis-signed request from ${req.ip}`);
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
      await processPaystackCharge(event.data, 'webhook');
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
    const { orderId, proofData, bankName, accountNumber, transferDate, transferReference } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!proofData) {
      return res.status(400).json({ message: 'Proof of payment is required' });
    }

    const { order, error } = await resolveOrderForRequester(req, orderId);
    if (error) {
      return res.status(403).json({ message: error });
    }

    const uploadResponse = await cloudinary.uploader.upload(proofData, {
      folder: 'bank_transfers',
      resource_type: 'image',
    });

    const transaction = await PaymentTransaction.findOneAndUpdate(
      {
        order: order._id,
        paymentMethod: 'bank_transfer',
      },
      {
        order: order._id,
        orderNumber: order.orderNumber,
        user: order.user || null,
        guest: order.guest || null,
        amount: order.totalAmount,
        currency: PAYSTACK_CURRENCY,
        paymentMethod: 'bank_transfer',
        gateway: 'manual',
        status: 'pending',
        bankTransferProof: uploadResponse.secure_url,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        transferDate: transferDate ? new Date(transferDate) : undefined,
        transferReference: transferReference || undefined,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
      },
      { upsert: true, new: true }
    );

    order.paymentMethod = 'bank_transfer';
    await order.save();

    res.json({
      success: true,
      message: 'Bank transfer proof uploaded successfully',
      transactionId: transaction._id,
      proofUrl: uploadResponse.secure_url,
    });
  } catch (error) {
    logger.error({ err: error }, 'Bank transfer proof upload error');
    res.status(500).json({ message: 'Failed to upload proof of payment' });
  }
};
