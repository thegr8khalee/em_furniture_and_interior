import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderByNumber,
  getAllOrders,
  getOneOrder,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  generateInvoice,
  generateReceipt,
  generateQuotation,
  generateDeliveryNote,
  getOrderRefunds,
  postOfflineSale,
  postOrderPayment,
  postOrderRefund,
} from '../controllers/order.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

// Public routes
router.post('/create', createLimiter, identifyGuest, trackActivity('ORDER_PLACED', 'order'), createOrder); // Allow both authenticated and guest orders
router.get('/track/:orderNumber', getOrderByNumber); // Track order by order number and email

// User routes (requires authentication or guest)
router.get('/my-orders', identifyGuest, getMyOrders); // Get user's orders
router.get('/:orderId', identifyGuest, getOrderById); // Get single order details
router.get('/:orderId/invoice', identifyGuest, generateInvoice); // Download invoice for own order
router.get('/:orderId/receipt', identifyGuest, generateReceipt); // Download receipt for own order
router.get('/:orderId/quotation', identifyGuest, generateQuotation); // Download quotation for own order
router.get('/:orderId/delivery-note', identifyGuest, generateDeliveryNote); // Download delivery note for own order

// Admin routes
router.get(
  '/admin/all',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  getAllOrders
);

// A sale that did not come through the website — the showroom, the phone, a
// WhatsApp thread. It goes through the same service the checkout does, so it is
// numbered, posted and stocked identically; the one difference is that the
// operator's agreed price wins over the list price, which is why this needs
// ORDERS_MANAGE and the checkout does not.
router.post(
  '/admin/sales',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('CREATE', 'offline_sale'),
  postOfflineSale
);

// One order in full, status history included. Registered after /admin/all so
// the literal path is matched before the parameter can swallow it.
router.get(
  '/admin/:orderId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  getOneOrder
);

router.put(
  '/admin/:orderId/status',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('UPDATE', 'order_status'),
  updateOrderStatus
);

router.put(
  '/admin/:orderId/payment',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('UPDATE', 'order_payment'),
  updatePaymentStatus
);

// Money in, recorded by hand — a transfer, cash in the workshop, a deposit
// taken before anything is built. The posting rule decides whether it is a
// deposit or settlement; this just records that it arrived.
router.post(
  '/admin/:orderId/payments',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('UPDATE', 'order_payment'),
  postOrderPayment
);

// Giving money back is not a status change, so it is not on the status route.
// It posts to the ledger, moves the receipt it reverses, and can bring the goods
// back into stock — all in one transaction, audited.
router.get(
  '/admin/:orderId/refunds',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  getOrderRefunds
);

router.post(
  '/admin/:orderId/refunds',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('UPDATE', 'order_refund'),
  postOrderRefund
);

router.delete(
  '/admin/:orderId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_MANAGE]),
  createAuditLog('DELETE', 'order'),
  deleteOrder
);

router.get(
  '/admin/:orderId/invoice',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  generateInvoice
);

router.get(
  '/admin/:orderId/receipt',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  generateReceipt
);

router.get(
  '/admin/:orderId/quotation',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  generateQuotation
);

router.get(
  '/admin/:orderId/delivery-note',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  generateDeliveryNote
);

export default router;
