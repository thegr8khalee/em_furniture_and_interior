import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderByNumber,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  generateInvoice,
  generateReceipt,
  generateQuotation
} from '../controllers/order.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { PERMISSIONS } from '../lib/permissions.js';
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

// Admin routes
router.get(
  '/admin/all',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ORDERS_VIEW]),
  getAllOrders
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

export default router;
