import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import GuestSession from '../models/guest.model.js';

/**
 * Shared, idempotent payment confirmation.
 *
 * Both the gateway webhook and the browser verify callback funnel through here,
 * so the two paths cannot drift apart in what they check or what they update.
 * The webhook is the source of truth; the browser callback is a convenience
 * that happens to reach the same code.
 */

/**
 * Gateways report amounts in different units — Paystack and Stripe both send
 * minor units, but that is a per-gateway convention and not something to
 * assume for any gateway added later. Orders store a float in major units, so
 * everything is normalised to integer minor units before comparison. Rounding here is deliberate: comparing floats
 * for equality is exactly the bug that finding F-11 is about.
 */
export const toMinorUnits = (amount, { alreadyMinor = false } = {}) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return alreadyMinor ? Math.round(value) : Math.round(value * 100);
};

export const RESULT = {
  CONFIRMED: 'confirmed',
  ALREADY_CONFIRMED: 'already_confirmed',
  AMOUNT_MISMATCH: 'amount_mismatch',
  CURRENCY_MISMATCH: 'currency_mismatch',
  FAILED: 'failed',
  ORDER_MISSING: 'order_missing',
};

/**
 * @param {object}  params
 * @param {object}  params.transaction     PaymentTransaction document
 * @param {boolean} params.successful      Did the gateway report success?
 * @param {number}  params.paidMinor       Amount settled, in minor units
 * @param {string}  params.currency        Currency the gateway settled in
 * @param {object}  params.gatewayResponse Raw gateway payload, stored for audit
 * @param {string}  params.source          'webhook' | 'callback'
 */
export const confirmOrderPayment = async ({
  transaction,
  successful,
  paidMinor,
  currency,
  gatewayResponse,
  source = 'webhook',
}) => {
  // Idempotency: a gateway will redeliver a webhook until it gets a 2xx, and the
  // customer can refresh the callback page. Neither may double-apply.
  if (transaction.status === 'success' && transaction.verified) {
    return { result: RESULT.ALREADY_CONFIRMED, order: await Order.findById(transaction.order) };
  }

  const order = await Order.findById(transaction.order);
  if (!order) {
    return { result: RESULT.ORDER_MISSING, order: null };
  }

  if (!successful) {
    transaction.gatewayResponse = gatewayResponse;
    transaction.status = 'failed';
    transaction.verified = false;
    transaction.verifiedAt = null;
    await transaction.save();
    return { result: RESULT.FAILED, order };
  }

  // --- Reconciliation (finding F-09) -------------------------------------
  // A gateway reporting "success" is not sufficient. Confirm it settled the
  // amount actually owed, in the currency the order was priced in. A shortfall
  // marked as paid is money the business never receives and never chases.
  const expectedMinor = toMinorUnits(order.totalAmount);

  if (currency && transaction.currency && currency.toUpperCase() !== transaction.currency.toUpperCase()) {
    transaction.gatewayResponse = gatewayResponse;
    transaction.status = 'failed';
    transaction.verified = false;
    transaction.verificationNotes =
      `Currency mismatch: gateway settled ${currency}, order priced ${transaction.currency}`;
    await transaction.save();
    return { result: RESULT.CURRENCY_MISMATCH, order, expectedMinor, paidMinor };
  }

  if (paidMinor === null || paidMinor !== expectedMinor) {
    transaction.gatewayResponse = gatewayResponse;
    transaction.status = 'failed';
    transaction.verified = false;
    transaction.verificationNotes =
      `Amount mismatch: gateway settled ${paidMinor}, order expected ${expectedMinor} (minor units)`;
    await transaction.save();

    // Deliberately leaves the order unpaid. A mismatch is a human decision —
    // partial settlement, a changed order, or an attack — never an auto-confirm.
    return { result: RESULT.AMOUNT_MISMATCH, order, expectedMinor, paidMinor };
  }

  // --- Confirm ------------------------------------------------------------
  transaction.gatewayResponse = gatewayResponse;
  transaction.status = 'success';
  transaction.verified = true;
  transaction.verifiedAt = new Date();
  transaction.verificationNotes = `Confirmed via ${source}`;
  await transaction.save();

  order.paymentStatus = 'paid';
  order.paymentMethod = transaction.gateway || transaction.paymentMethod;
  if (order.status === 'pending') {
    order.status = 'confirmed';
  }
  await order.save();

  // Clearing the cart must never fail the confirmation — the money has landed
  // and the order is paid regardless of whether the cart tidy-up succeeds.
  try {
    if (order.user) {
      await User.findByIdAndUpdate(order.user, { cart: [] });
    } else if (order.guest) {
      await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
    }
  } catch (cartError) {
    console.error('Failed to clear cart after payment confirmation:', cartError.message);
  }

  return { result: RESULT.CONFIRMED, order };
};
