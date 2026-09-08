import crypto from 'crypto';
import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { applyPaymentToOrder } from './orders.js';
import { postPaymentReceived } from './posting.js';
import { logger } from '../lib/logger.js';

/**
 * Payments, against PostgreSQL.
 *
 * A charge arrives twice — once when the customer is redirected back, once from
 * the webhook — and sometimes at the same instant. Everything here is written so
 * that the second arrival changes nothing: the transaction is claimed with a
 * conditional UPDATE, and the order work happens only for whoever won the
 * claim, inside the same database transaction.
 *
 * `payment_transactions.gateway_reference` is unique, which is what makes a
 * replayed webhook a lookup rather than a second charge. Mongo had no such
 * index; the idempotency was entirely in the handler.
 *
 * Amounts are kobo end to end. Paystack works in the currency's minor unit and
 * so does the database, so nothing in the payment path converts to naira and
 * back — that round trip is where a kobo goes missing.
 */

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_CURRENCY = 'NGN';

export class PaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

const paystackSecret = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
};

const paystackHeaders = () => ({
  Authorization: `Bearer ${paystackSecret()}`,
  'Content-Type': 'application/json',
});

/**
 * Paystack signs the raw request body with HMAC-SHA512 keyed on the secret key.
 * Compared in constant time so a wrong signature cannot be narrowed down by
 * timing the response.
 */
export const verifyPaystackSignature = (
  rawBody,
  signature,
  secret = process.env.PAYSTACK_SECRET_KEY
) => {
  if (!secret || !signature || rawBody == null) return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const provided = String(signature);

  // timingSafeEqual throws on a length mismatch, so length is checked first.
  // The digest length is fixed and public, so this leaks nothing useful.
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
};

/**
 * The gateway's reported amount must equal what we asked it to charge.
 *
 * Both figures are minor units. Without this, a replayed event from a cheaper
 * order — or a caller who can influence the charge — marks an order paid for
 * the wrong sum.
 */
export const chargeMatchesOrder = (charge, expectedMinor) =>
  Number.isFinite(Number(charge?.amount)) &&
  Number(charge.amount) === Number(expectedMinor) &&
  String(charge?.currency).toUpperCase() === PAYSTACK_CURRENCY;

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/**
 * The order, if this requester may pay for it.
 *
 * The same arc as everywhere else: a signed-in shopper owns orders by
 * `customer_id`, a guest by `guest_session_id`. An order nobody can prove they
 * own is not payable through this endpoint.
 */
const orderForOwner = async (db, owner, orderId) => {
  if (!isValidId(String(orderId ?? ''))) throw new PaymentError('Order not found', 404);

  const order = await selectOne(
    db,
    `SELECT id, order_number, customer_id, guest_session_id, total_amount, payment_status,
            shipping_address, billing_address
       FROM orders WHERE id = :orderId`,
    { orderId }
  );
  if (!order) throw new PaymentError('Order not found', 404);

  const theirs = owner.customerId
    ? order.customer_id === owner.customerId
    : order.guest_session_id === owner.guestSessionId;

  if (!theirs) throw new PaymentError('Not authorized for this order', 403);

  return order;
};

const buyerEmail = async (db, order) => {
  const fromOrder = order.shipping_address?.email || order.billing_address?.email;
  if (fromOrder) return fromOrder;

  if (!order.customer_id) return null;
  const customer = await selectOne(db, 'SELECT email FROM customers WHERE id = :id', {
    id: order.customer_id,
  });
  return customer?.email ?? null;
};

/**
 * Starts a hosted checkout, or hands back the one already in flight.
 *
 * Reusing a pending attempt keeps one reference for a customer who goes back
 * and retries — but only while it still bills the current total, because a
 * reference is bound to the amount it was created for.
 */
export const beginPaystackCheckout = async (
  owner,
  orderId,
  { ip = null, userAgent = null, fetchImpl = fetch } = {},
  db = getSequelize()
) => {
  const order = await orderForOwner(db, owner, orderId);

  if (order.payment_status === 'paid') {
    throw new PaymentError('Order already paid');
  }

  const inFlight = await selectOne(
    db,
    `SELECT id, gateway_reference, gateway_response, amount
       FROM payment_transactions
      WHERE order_id = :orderId AND payment_method = 'paystack'
        AND status IN ('pending', 'processing')
      ORDER BY created_at DESC LIMIT 1`,
    { orderId: order.id }
  );

  const authorizationUrl = inFlight?.gateway_response?.authorization_url;
  if (inFlight && authorizationUrl && Number(inFlight.amount) === Number(order.total_amount)) {
    return {
      authorizationUrl,
      reference: inFlight.gateway_reference,
      transactionId: inFlight.id,
      orderId: order.id,
    };
  }

  const email = await buyerEmail(db, order);
  if (!email) throw new PaymentError('Customer email is required for payment');

  const reference = `EM-${order.order_number}-${Date.now()}`;

  const response = await fetchImpl(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: paystackHeaders(),
    body: JSON.stringify({
      email,
      // Already minor units in the database, which is what Paystack wants.
      amount: Number(order.total_amount),
      currency: PAYSTACK_CURRENCY,
      reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/verify`,
      metadata: { orderId: order.id, orderNumber: order.order_number },
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new PaymentError(data?.message || 'Failed to initialize Paystack payment');
  }

  const created = await selectOne(
    db,
    `INSERT INTO payment_transactions
       (order_id, amount, currency, payment_method, gateway_reference, gateway_response,
        status, ip_address, user_agent)
     VALUES (:orderId, :amount, :currency, 'paystack', :reference, :response,
             'pending', :ip, :userAgent)
     RETURNING id`,
    {
      orderId: order.id,
      amount: Number(order.total_amount),
      currency: PAYSTACK_CURRENCY,
      reference,
      response: JSON.stringify(data.data),
      ip,
      userAgent,
    }
  );

  return {
    authorizationUrl: data.data.authorization_url,
    reference,
    transactionId: created.id,
    orderId: order.id,
  };
};

/** Asks Paystack what actually happened to a reference. */
export const fetchPaystackCharge = async (reference, fetchImpl = fetch) => {
  const response = await fetchImpl(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET', headers: paystackHeaders() }
  );

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new PaymentError(data?.message || 'Failed to verify payment');
  }
  return data.data;
};

const markFailed = (db, transactionId, charge, notes) =>
  db.query(
    `UPDATE payment_transactions
        SET status = 'failed', gateway_response = :response, verification_notes = :notes
      WHERE id = :id AND status NOT IN ('success', 'refunded')`,
    { replacements: { id: transactionId, response: JSON.stringify(charge ?? {}), notes } }
  );

/**
 * Records what a gateway said about a charge, and acts on it exactly once.
 *
 * The outcomes are deliberately distinguishable, because the caller answers
 * differently to each: `unknown_reference` is a 404, `amount_mismatch` is a 409
 * that must reach a human, and `already_applied` is a success — it is what a
 * webhook arriving after the redirect looks like, and treating it as an error
 * would make Paystack retry for days over an order that is already paid.
 */
export const applyPaystackCharge = async (charge, source, db = getSequelize()) => {
  const reference = charge?.reference;
  if (!reference) return { outcome: 'no_reference' };

  const transaction = await selectOne(
    db,
    `SELECT t.id, t.order_id, t.amount, t.status, o.order_number, o.total_amount
       FROM payment_transactions t
       JOIN orders o ON o.id = t.order_id
      WHERE t.gateway_reference = :reference`,
    { reference }
  );

  if (!transaction) {
    // Not a reference we issued — another environment sharing the key, or a
    // charge created outside checkout. Nothing to reconcile.
    logger.warn({ reference, source }, 'Paystack: no transaction for this reference');
    return { outcome: 'unknown_reference' };
  }

  if (charge.status !== 'success') {
    await markFailed(db, transaction.id, charge, `Gateway reported "${charge?.status}" via ${source}`);
    return { outcome: 'not_successful', transaction };
  }

  if (!chargeMatchesOrder(charge, transaction.total_amount)) {
    const notes =
      `Amount/currency mismatch via ${source}: gateway reported ` +
      `${charge?.amount} ${charge?.currency}, order expects ` +
      `${transaction.total_amount} ${PAYSTACK_CURRENCY}`;
    await markFailed(db, transaction.id, charge, notes);
    logger.error({ reference, orderNumber: transaction.order_number, source }, notes);
    return { outcome: 'amount_mismatch', transaction };
  }

  return db.transaction(async (dbTransaction) => {
    const opts = { transaction: dbTransaction };

    // The claim. Only one caller can move a transaction out of not-success, so
    // only one caller does the order work below.
    const claimed = await selectOne(
      db,
      `UPDATE payment_transactions
          SET status = 'success', verified_at = now(),
              gateway_response = :response, verification_notes = :notes,
              gateway_fee = LEAST(:fee, amount)
        WHERE id = :id AND status <> 'success'
        RETURNING id`,
      {
        id: transaction.id,
        response: JSON.stringify(charge),
        notes: `Confirmed via ${source}`,
        // Paystack reports its cut in kobo on the verify response, in the same
        // minor units the ledger uses. Recording the gross and ignoring this is
        // what overstated every cash balance by every fee ever charged.
        // Clamped, because a fee larger than the payment is a gateway bug and
        // the check constraint would take the whole transaction down with it.
        fee: Math.max(0, Math.round(Number(charge?.fees ?? 0))),
      },
      opts
    );

    if (!claimed) return { outcome: 'already_applied', transaction };

    const { customerId } = await applyPaymentToOrder(
      db,
      transaction.order_id,
      { note: `Payment confirmed via Paystack (${source})`, method: 'paystack' },
      opts
    );

    await postPaymentReceived(db, transaction.id, opts);

    logger.info(
      { orderNumber: transaction.order_number, reference, source },
      'Order marked paid'
    );

    return { outcome: 'applied', transaction, customerId };
  });
};

/**
 * Attaches proof of a bank transfer to an order.
 *
 * It does not mark anything paid: somebody has to look at the slip. The
 * transaction sits `pending` until an operator moves the order's payment status,
 * which is the same path a cash sale takes.
 *
 * The account number the old form collected is not stored. It is the one field
 * on that form with no use — the transfer is identified by its reference — and
 * a bank account number sitting in an admin list is a liability, not a record.
 */
export const recordBankTransferProof = async (
  owner,
  { orderId, proofUrl, bankName = null, transferDate = null, transferReference = null },
  db = getSequelize()
) => {
  const order = await orderForOwner(db, owner, orderId);

  const row = await selectOne(
    db,
    `INSERT INTO payment_transactions
       (order_id, amount, payment_method, status, bank_transfer_proof, bank_name,
        transfer_date, transfer_reference)
     VALUES (:orderId, :amount, 'bank_transfer', 'pending', :proofUrl, :bankName,
             :transferDate::date, :transferReference)
     RETURNING id`,
    {
      orderId: order.id,
      amount: Number(order.total_amount),
      proofUrl,
      bankName,
      transferDate,
      transferReference,
    }
  );

  await db.query(
    `UPDATE orders SET payment_method = 'bank_transfer' WHERE id = :orderId`,
    { replacements: { orderId: order.id } }
  );

  return { transactionId: row.id, proofUrl };
};
