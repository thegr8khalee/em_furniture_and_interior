import Order from '../models/order.model.js';
import PaymentTransaction from '../models/paymentTransaction.model.js';
import GuestSession from '../models/guest.model.js';
import User from '../models/user.model.js';
import cloudinary from '../lib/cloudinary.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

const getPaystackHeaders = () => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };
};

const getFlutterwaveHeaders = () => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };
};

const getStripeHeaders = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
};

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

    const pendingTransaction = await PaymentTransaction.findOne({
      order: order._id,
      paymentMethod: 'paystack',
      status: { $in: ['pending', 'processing'] },
    });

    if (pendingTransaction?.gatewayReference) {
      return res.json({
        success: true,
        authorizationUrl: pendingTransaction.metadata?.authorizationUrl,
        reference: pendingTransaction.gatewayReference,
        orderId: order._id,
      });
    }

    const userEmail = order?.shippingAddress?.email || order?.billingAddress?.email;
    let customerEmail = userEmail;

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
      amount: Math.round(order.totalAmount * 100),
      currency: 'NGN',
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
      currency: 'NGN',
      paymentMethod: 'paystack',
      gateway: 'paystack',
      gatewayReference: reference,
      status: 'pending',
      metadata: {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      reference: reference,
      transactionId: transaction._id,
      orderId: order._id,
    });
  } catch (error) {
    console.error('Paystack initialize error:', error);
    res.status(500).json({ message: 'Failed to initialize payment' });
  }
};

export const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: getPaystackHeaders(),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(400).json({
        message: data?.message || 'Failed to verify payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.findOne({ gatewayReference: reference });
    if (!transaction) {
      return res.status(404).json({ message: 'Payment transaction not found' });
    }

    transaction.gatewayResponse = data.data;
    transaction.status = data.data.status === 'success' ? 'success' : 'failed';
    transaction.verified = data.data.status === 'success';
    transaction.verifiedAt = data.data.status === 'success' ? new Date() : null;
    await transaction.save();

    const order = await Order.findById(transaction.order);
    if (order && data.data.status === 'success') {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'paystack';
      if (order.status === 'pending') {
        order.status = 'confirmed';
      }
      await order.save();

      // Clear cart after confirmed payment
      if (order.user) {
        await User.findByIdAndUpdate(order.user, { cart: [] });
      } else if (order.guest) {
        await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
      }
    }

    res.json({
      success: true,
      status: data.data.status,
      orderId: order?._id,
      orderNumber: order?.orderNumber,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error('Paystack verification error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

export const initializeFlutterwavePayment = async (req, res) => {
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

    const pendingTransaction = await PaymentTransaction.findOne({
      order: order._id,
      paymentMethod: 'flutterwave',
      status: { $in: ['pending', 'processing'] },
    });

    if (pendingTransaction?.gatewayReference) {
      return res.json({
        success: true,
        authorizationUrl: pendingTransaction.metadata?.authorizationUrl,
        reference: pendingTransaction.gatewayReference,
        orderId: order._id,
      });
    }

    const userEmail = order?.shippingAddress?.email || order?.billingAddress?.email;
    let customerEmail = userEmail;

    if (!customerEmail && order.user) {
      const user = await User.findById(order.user);
      customerEmail = user?.email;
    }

    if (!customerEmail) {
      return res.status(400).json({ message: 'Customer email is required for payment' });
    }

    const txRef = `EM-FLW-${order.orderNumber}-${Date.now()}`;
    const payload = {
      tx_ref: txRef,
      amount: order.totalAmount,
      currency: process.env.FLUTTERWAVE_CURRENCY || 'NGN',
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/verify`,
      customer: {
        email: customerEmail,
        name: order?.shippingAddress?.fullName || 'Customer',
      },
      meta: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    };

    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: 'POST',
      headers: getFlutterwaveHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data?.status !== 'success') {
      return res.status(400).json({
        message: data?.message || 'Failed to initialize Flutterwave payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      user: order.user || null,
      guest: order.guest || null,
      amount: order.totalAmount,
      currency: process.env.FLUTTERWAVE_CURRENCY || 'NGN',
      paymentMethod: 'flutterwave',
      gateway: 'flutterwave',
      gatewayReference: txRef,
      status: 'pending',
      metadata: {
        authorizationUrl: data.data?.link,
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      authorizationUrl: data.data?.link,
      reference: txRef,
      transactionId: transaction._id,
      orderId: order._id,
    });
  } catch (error) {
    console.error('Flutterwave initialize error:', error);
    res.status(500).json({ message: 'Failed to initialize payment' });
  }
};

export const verifyFlutterwavePayment = async (req, res) => {
  try {
    const { tx_ref: txRef } = req.query;

    if (!txRef) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const response = await fetch(
      `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      {
        method: 'GET',
        headers: getFlutterwaveHeaders(),
      }
    );

    const data = await response.json();

    if (!response.ok || data?.status !== 'success') {
      return res.status(400).json({
        message: data?.message || 'Failed to verify Flutterwave payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.findOne({ gatewayReference: txRef });
    if (!transaction) {
      return res.status(404).json({ message: 'Payment transaction not found' });
    }

    const paymentSuccessful = data.data?.status === 'successful';
    transaction.gatewayResponse = data.data;
    transaction.status = paymentSuccessful ? 'success' : 'failed';
    transaction.verified = paymentSuccessful;
    transaction.verifiedAt = paymentSuccessful ? new Date() : null;
    await transaction.save();

    const order = await Order.findById(transaction.order);
    if (order && paymentSuccessful) {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'flutterwave';
      if (order.status === 'pending') {
        order.status = 'confirmed';
      }
      await order.save();

      // Clear cart after confirmed payment
      if (order.user) {
        await User.findByIdAndUpdate(order.user, { cart: [] });
      } else if (order.guest) {
        await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
      }
    }

    res.json({
      success: true,
      status: paymentSuccessful ? 'success' : 'failed',
      orderId: order?._id,
      orderNumber: order?.orderNumber,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error('Flutterwave verification error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

export const initializeStripePayment = async (req, res) => {
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

    const pendingTransaction = await PaymentTransaction.findOne({
      order: order._id,
      paymentMethod: 'stripe',
      status: { $in: ['pending', 'processing'] },
    });

    if (pendingTransaction?.gatewayReference) {
      return res.json({
        success: true,
        authorizationUrl: pendingTransaction.metadata?.authorizationUrl,
        reference: pendingTransaction.gatewayReference,
        orderId: order._id,
      });
    }

    const userEmail = order?.shippingAddress?.email || order?.billingAddress?.email;
    let customerEmail = userEmail;

    if (!customerEmail && order.user) {
      const user = await User.findById(order.user);
      customerEmail = user?.email;
    }

    if (!customerEmail) {
      return res.status(400).json({ message: 'Customer email is required for payment' });
    }

    const currency = (process.env.STRIPE_CURRENCY || 'NGN').toLowerCase();
    const amount = Math.round(order.totalAmount * 100);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', customerEmail);
    params.append(
      'success_url',
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/verify?session_id={CHECKOUT_SESSION_ID}`
    );
    params.append(
      'cancel_url',
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout?cancelled=1`
    );
    params.append('line_items[0][price_data][currency]', currency);
    params.append('line_items[0][price_data][product_data][name]', `Order ${order.orderNumber}`);
    params.append('line_items[0][price_data][unit_amount]', amount.toString());
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[orderId]', order._id.toString());
    params.append('metadata[orderNumber]', order.orderNumber);

    const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: getStripeHeaders(),
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data?.id) {
      return res.status(400).json({
        message: data?.error?.message || 'Failed to initialize Stripe payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      user: order.user || null,
      guest: order.guest || null,
      amount: order.totalAmount,
      currency: currency.toUpperCase(),
      paymentMethod: 'stripe',
      gateway: 'stripe',
      gatewayReference: data.id,
      status: 'pending',
      metadata: {
        authorizationUrl: data.url,
      },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      authorizationUrl: data.url,
      reference: data.id,
      transactionId: transaction._id,
      orderId: order._id,
    });
  } catch (error) {
    console.error('Stripe initialize error:', error);
    res.status(500).json({ message: 'Failed to initialize payment' });
  }
};

export const verifyStripePayment = async (req, res) => {
  try {
    const { session_id: sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ message: 'Stripe session ID is required' });
    }

    const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: getStripeHeaders(),
    });

    const data = await response.json();

    if (!response.ok || !data?.id) {
      return res.status(400).json({
        message: data?.error?.message || 'Failed to verify Stripe payment',
        error: data,
      });
    }

    const transaction = await PaymentTransaction.findOne({ gatewayReference: sessionId });
    if (!transaction) {
      return res.status(404).json({ message: 'Payment transaction not found' });
    }

    const paymentSuccessful = data.payment_status === 'paid';
    transaction.gatewayResponse = data;
    transaction.status = paymentSuccessful ? 'success' : 'failed';
    transaction.verified = paymentSuccessful;
    transaction.verifiedAt = paymentSuccessful ? new Date() : null;
    await transaction.save();

    const order = await Order.findById(transaction.order);
    if (order && paymentSuccessful) {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'stripe';
      if (order.status === 'pending') {
        order.status = 'confirmed';
      }
      await order.save();

      // Clear cart after confirmed payment
      if (order.user) {
        await User.findByIdAndUpdate(order.user, { cart: [] });
      } else if (order.guest) {
        await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
      }
    }

    res.json({
      success: true,
      status: paymentSuccessful ? 'success' : 'failed',
      orderId: order?._id,
      orderNumber: order?.orderNumber,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error('Stripe verification error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
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
        currency: 'NGN',
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
    if (order.paymentStatus === 'pending') {
      order.paymentStatus = 'pending';
    }
    await order.save();

    res.json({
      success: true,
      message: 'Bank transfer proof uploaded successfully',
      transactionId: transaction._id,
      proofUrl: uploadResponse.secure_url,
    });
  } catch (error) {
    console.error('Bank transfer proof upload error:', error);
    res.status(500).json({ message: 'Failed to upload proof of payment' });
  }
};
