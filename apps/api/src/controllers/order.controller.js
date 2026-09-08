import { resolveOwner } from '../lib/owner.js';
import { CartError, clearCart } from '../services/cart.js';
import { generateInvoicePDF, generateOrderDocumentPDF } from '../lib/invoiceGenerator.js';
import { createNotification } from './notification.controller.js';
import { sendEmail } from '../services/gmail.service.js';
import { logger } from '../lib/logger.js';
import { RefundError, listRefunds, refundOrder } from '../services/refunds.js';
import {
  OrderError,
  deleteOrder as deleteOrderRow,
  getOrder,
  getOrderForOwner,
  listOrders,
  listOrdersForOwner,
  placeOrder,
  setOrderStatus,
  setPaymentStatus,
  trackOrder,
} from '../services/orders.js';

/*
 * Orders. The pricing, the coupon, the ledger posting and the stock movement
 * are in services/orders.js; these handlers translate the request, translate
 * the error, and send the mail.
 *
 * Notifications and email stay here because they are not part of the order:
 * neither may fail a checkout that the database has already committed.
 */

const fail = (error, res, where) => {
  if (error instanceof OrderError || error instanceof CartError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where}`);
  return res.status(500).json({ message: 'Server error' });
};

const naira = (amount) => `₦${Number(amount).toLocaleString('en-NG')}`;

const paginate = (req, fallback) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || fallback, 1), 100);
  return { page, limit };
};

const withPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

/**
 * Tells the shopper their order exists.
 *
 * Deliberately after the response is decided and never able to change it: the
 * order is committed, and a mail server that is down must not turn a successful
 * checkout into a 500 that invites the shopper to order again.
 */
const announceOrder = async (order) => {
  if (order.user) {
    await createNotification({
      userId: order.user,
      title: 'Order placed successfully',
      message: `Your order ${order.orderNumber} has been placed and is pending confirmation.`,
      type: 'order',
      relatedOrder: order._id,
    }).catch((error) => logger.error({ err: error }, 'Could not create the order notification'));
  }

  const to = order.shippingAddress?.email;
  if (!to) return;

  const lines = order.items
    .map((item) => `${item.name} x${item.quantity} — ${naira(item.subtotal)}`)
    .join('\n');

  try {
    await sendEmail({
      to,
      subject: `Order Confirmation — ${order.orderNumber}`,
      text: `Your order ${order.orderNumber} has been placed.\n\nItems:\n${lines}\n\nTotal: ${naira(order.totalAmount)}\n\nWe'll notify you when it ships.`,
      html: `
        <h2>Order Confirmation</h2>
        <p>Hi, your order <strong>${order.orderNumber}</strong> has been placed successfully.</p>
        <h3>Items</h3>
        <ul>${order.items.map((item) => `<li>${item.name} x${item.quantity} — ${naira(item.subtotal)}</li>`).join('')}</ul>
        <p><strong>Total: ${naira(order.totalAmount)}</strong></p>
        <p>We'll notify you when your order status changes.</p>
        <p>Thank you,<br/>EM Furniture and Interior Team</p>
      `,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send order confirmation email');
  }
};

// Create a new order (for authenticated users and guests)
export const createOrder = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const { order, duplicate } = await placeOrder(owner, {
      ...req.body,
      idempotencyKey: req.get('idempotency-key') || req.body?.idempotencyKey || null,
    });

    if (!duplicate) await announceOrder(order);

    res.status(201).json({
      success: true,
      message: duplicate ? 'Order already placed' : 'Order created successfully',
      order,
    });
  } catch (error) {
    fail(error, res, 'createOrder');
  }
};

// Get all orders for the authenticated user
export const getMyOrders = async (req, res) => {
  const { page, limit } = paginate(req, 10);

  try {
    const owner = await resolveOwner(req);
    const { orders, total } = await listOrdersForOwner(owner, { page, limit });

    res.json({ success: true, orders, pagination: withPagination(page, limit, total) });
  } catch (error) {
    // A shopper with no session has no orders; that is an empty list, not an
    // error, and the storefront renders it as "you have not ordered yet".
    if (error instanceof CartError && error.status === 401) {
      return res.json({ success: true, orders: [], pagination: withPagination(page, limit, 0) });
    }
    fail(error, res, 'getMyOrders');
  }
};

// Get a single order by ID
export const getOrderById = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    res.json({ success: true, order: await getOrderForOwner(owner, req.params.orderId) });
  } catch (error) {
    fail(error, res, 'getOrderById');
  }
};

// Get order by order number (for tracking without login)
export const getOrderByNumber = async (req, res) => {
  try {
    const order = await trackOrder(req.params.orderNumber, req.query.email);
    res.json({ success: true, order });
  } catch (error) {
    fail(error, res, 'getOrderByNumber');
  }
};

// Admin: Get all orders with filters
export const getAllOrders = async (req, res) => {
  const { page, limit } = paginate(req, 20);

  try {
    const { orders, total } = await listOrders({
      page,
      limit,
      status: req.query.status || null,
      paymentStatus: req.query.paymentStatus || null,
      search: req.query.search || null,
    });

    res.json({ success: true, orders, pagination: withPagination(page, limit, total) });
  } catch (error) {
    fail(error, res, 'getAllOrders');
  }
};

/** Tells the shopper their order has moved. Same rule as above: cannot fail the change. */
const announceStatus = async (order, status, points) => {
  if (order.user) {
    await createNotification({
      userId: order.user,
      title: 'Order status updated',
      message: `Your order ${order.orderNumber} is now ${order.status.toUpperCase()}.`,
      type: 'order',
      relatedOrder: order._id,
    }).catch((error) => logger.error({ err: error }, 'Could not create the status notification'));

    if (points > 0) {
      await createNotification({
        userId: order.user,
        title: 'Loyalty points earned',
        message: `You earned ${points} points from order ${order.orderNumber}.`,
        type: 'loyalty',
        relatedOrder: order._id,
      }).catch((error) => logger.error({ err: error }, 'Could not create the loyalty notification'));
    }
  }

  const to = order.shippingAddress?.email;
  if (!to || !status) return;

  const tracking = order.trackingNumber
    ? `<p>Tracking: ${order.trackingNumber}${order.trackingUrl ? ` — <a href="${order.trackingUrl}">Track here</a>` : ''}</p>`
    : '';

  try {
    await sendEmail({
      to,
      subject: `Order ${order.orderNumber} — ${status.charAt(0).toUpperCase()}${status.slice(1)}`,
      text: `Your order ${order.orderNumber} is now ${status}.${order.trackingNumber ? ` Tracking: ${order.trackingNumber}` : ''}`,
      html: `
        <h2>Order Status Update</h2>
        <p>Your order <strong>${order.orderNumber}</strong> is now <strong>${status.toUpperCase()}</strong>.</p>
        ${tracking}
        <p>Thank you,<br/>EM Furniture and Interior Team</p>
      `,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send order status email');
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { order, loyaltyPoints } = await setOrderStatus(
      req.params.orderId,
      req.body,
      req.admin.id
    );

    await announceStatus(order, req.body?.status, loyaltyPoints);

    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    fail(error, res, 'updateOrderStatus');
  }
};

// Admin: Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { order, customerId, nowPaid } = await setPaymentStatus(
      req.params.orderId,
      req.body?.paymentStatus,
      req.admin.id
    );

    // A paid order is a finished basket.
    if (nowPaid && customerId) {
      await clearCart({ customerId, guestSessionId: null }).catch((error) =>
        logger.error({ err: error }, 'Could not clear the cart after payment')
      );
    }

    res.json({ success: true, message: 'Payment status updated successfully', order });
  } catch (error) {
    fail(error, res, 'updatePaymentStatus');
  }
};

// Admin: Delete order
export const deleteOrder = async (req, res) => {
  try {
    if (!(await deleteOrderRow(req.params.orderId))) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    fail(error, res, 'deleteOrder');
  }
};

/**
 * The order behind a document request.
 *
 * An operator may print any order; a shopper may print only their own. The
 * routes differ in their middleware, and `req.admin` is what distinguishes
 * them — without this check the customer-facing invoice route would print
 * anybody's order to anybody who guessed an id.
 */
const orderForDocument = async (req) =>
  req.admin ? getOrder(req.params.orderId) : getOrderForOwner(await resolveOwner(req), req.params.orderId);

// Generate invoice PDF
export const generateInvoice = async (req, res) => {
  try {
    await generateInvoicePDF(await orderForDocument(req), res);
  } catch (error) {
    fail(error, res, 'generateInvoice');
  }
};

// Generate receipt PDF (paid orders only)
export const generateReceipt = async (req, res) => {
  try {
    const order = await orderForDocument(req);

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Receipt available only for paid orders' });
    }

    await generateOrderDocumentPDF(order, res, 'receipt');
  } catch (error) {
    fail(error, res, 'generateReceipt');
  }
};

// Generate quotation PDF
export const generateQuotation = async (req, res) => {
  try {
    await generateOrderDocumentPDF(await orderForDocument(req), res, 'quotation');
  } catch (error) {
    fail(error, res, 'generateQuotation');
  }
};

/*
 * Refunds.
 *
 * Deliberately not folded into the status dropdown. Marking an order "refunded"
 * used to be a word on a screen — the money, the VAT, the revenue and the stock
 * all stayed exactly where they were. Giving money back is its own act with its
 * own amount and its own reason, so it is its own endpoint.
 */

const failRefund = (error, res, where) => {
  if (error instanceof RefundError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getOrderRefunds = async (req, res) => {
  try {
    res.json({ success: true, ...(await listRefunds(req.params.orderId)) });
  } catch (error) {
    failRefund(error, res, 'Error listing refunds');
  }
};

export const postOrderRefund = async (req, res) => {
  try {
    const refund = await refundOrder(req.params.orderId, {
      amount: req.body?.amount ?? null,
      reason: req.body?.reason,
      restock: req.body?.restock === true,
      refundedOn: req.body?.refundedOn || null,
      staffId: req.admin?.id ?? null,
    });

    res.status(201).json({
      success: true,
      refund,
      message: `₦${refund.amount.toLocaleString()} refunded on ${refund.orderNumber}.`,
    });
  } catch (error) {
    failRefund(error, res, 'Error refunding an order');
  }
};
