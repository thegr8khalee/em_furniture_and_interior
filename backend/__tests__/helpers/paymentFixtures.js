import crypto from 'crypto';
import Order from '../../src/models/order.model.js';
import PaymentTransaction from '../../src/models/paymentTransaction.model.js';

export const PAYSTACK_SECRET = 'sk_test_paystack_secret';
export const STRIPE_SECRET = 'whsec_test_stripe_secret';

const address = {
  fullName: 'Ada Obi',
  phone: '+2348012345678',
  email: 'ada@example.com',
  address: '12 Awolowo Road',
  city: 'Ikoyi',
  state: 'Lagos',
  country: 'Nigeria',
};

/** An unpaid order plus a pending transaction, as initialize() would leave them. */
export const createPendingPayment = async ({
  totalAmount = 150000,
  gateway = 'paystack',
  reference = 'EM-TEST-REF-1',
  currency = 'NGN',
} = {}) => {
  const order = await Order.create({
    items: [
      {
        item: new (await import('mongoose')).default.Types.ObjectId(),
        itemType: 'Product',
        name: 'Panama Armchair',
        price: totalAmount,
        quantity: 1,
        subtotal: totalAmount,
      },
    ],
    shippingAddress: address,
    subtotal: totalAmount,
    totalAmount,
    status: 'pending',
    paymentStatus: 'pending',
    isGuestOrder: true,
  });

  const transaction = await PaymentTransaction.create({
    order: order._id,
    orderNumber: order.orderNumber,
    amount: totalAmount,
    currency,
    paymentMethod: gateway,
    gateway,
    gatewayReference: reference,
    status: 'pending',
  });

  return { order, transaction };
};

export const paystackBody = ({ reference, amountKobo, status = 'success', id = 999001 }) =>
  JSON.stringify({
    event: 'charge.success',
    data: { id, reference, amount: amountKobo, currency: 'NGN', status },
  });

export const paystackSignature = (rawBody, secret = PAYSTACK_SECRET) =>
  crypto.createHmac('sha512', secret).update(Buffer.from(rawBody)).digest('hex');

export const stripeBody = ({ reference, amountMinor, paymentStatus = 'paid', id = 'evt_test_1' }) =>
  JSON.stringify({
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: reference,
        amount_total: amountMinor,
        currency: 'ngn',
        payment_status: paymentStatus,
      },
    },
  });

export const stripeSignature = (rawBody, secret = STRIPE_SECRET, timestamp = Math.floor(Date.now() / 1000)) => {
  const signed = `${timestamp}.${rawBody}`;
  const sig = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
};
