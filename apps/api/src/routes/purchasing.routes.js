import express from 'express';
import {
  deleteVendor,
  getExpenses,
  getOneExpense,
  getOnePurchaseOrder,
  getPayables,
  getPurchaseOrders,
  getVendors,
  patchExpense,
  patchPurchaseOrder,
  patchVendor,
  postExpense,
  postExpenseApproval,
  postExpensePayment,
  postExpenseVoid,
  postPurchaseOrder,
  postPurchaseOrderCancel,
  postPurchaseOrderPayment,
  postPurchaseOrderReceipt,
  postPurchaseOrderSend,
  postVendor,
} from '../controllers/purchasing.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// What the business buys is nobody's business but the console's.
router.use(protectAdminRoute);

// Reading is a finance question; spending is a purchasing authority.
const canRead = requirePermissions([PERMISSIONS.FINANCE_VIEW]);
const canSpend = requirePermissions([PERMISSIONS.PURCHASING_MANAGE]);

// --- vendors ---------------------------------------------------------------
router.get('/vendors', canRead, getVendors);
router.post('/vendors', canSpend, createAuditLog('CREATE', 'vendor'), postVendor);
router.patch('/vendors/:vendorId', canSpend, createAuditLog('UPDATE', 'vendor'), patchVendor);
router.delete('/vendors/:vendorId', canSpend, createAuditLog('DELETE', 'vendor'), deleteVendor);

// --- expenses --------------------------------------------------------------
//
// Approving and paying are audited separately from recording, because they are
// the two steps that move the books: one creates the debt, the other settles it.
router.get('/expenses', canRead, getExpenses);
router.get('/expenses/:expenseId', canRead, getOneExpense);
router.post('/expenses', canSpend, createAuditLog('CREATE', 'expense'), postExpense);

// Correcting one before it is approved. After approval it has been posted, and
// the service refuses — a cost that is in the books is changed by voiding it and
// recording it again, so that the ledger and the document never disagree.
router.patch('/expenses/:expenseId', canSpend, createAuditLog('UPDATE', 'expense'), patchExpense);

router.post(
  '/expenses/:expenseId/approve',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'expense'),
  postExpenseApproval
);

router.post(
  '/expenses/:expenseId/pay',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'expense'),
  postExpensePayment
);

router.post(
  '/expenses/:expenseId/void',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'expense'),
  postExpenseVoid
);

router.get('/payables', canRead, getPayables);

// --- purchase orders -------------------------------------------------------
router.get('/purchase-orders', canRead, getPurchaseOrders);
router.get('/purchase-orders/:orderId', canRead, getOnePurchaseOrder);

router.post(
  '/purchase-orders',
  canSpend,
  createAuditLog('CREATE', 'purchase_order'),
  postPurchaseOrder
);

// Same rule as an expense: draft only. Once it has been sent somebody else is
// acting on it, and once it has been received it has made stock and a debt.
router.patch(
  '/purchase-orders/:orderId',
  canSpend,
  createAuditLog('UPDATE', 'purchase_order'),
  patchPurchaseOrder
);

router.post(
  '/purchase-orders/:orderId/send',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'purchase_order'),
  postPurchaseOrderSend
);

// Receiving is the one that creates stock and a liability at the same time.
router.post(
  '/purchase-orders/:orderId/receive',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'purchase_order'),
  postPurchaseOrderReceipt
);

// Settling what the receipt made owed.
router.post(
  '/purchase-orders/:orderId/pay',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'purchase_order'),
  postPurchaseOrderPayment
);

router.post(
  '/purchase-orders/:orderId/cancel',
  canSpend,
  createAuditLog('STATUS_CHANGE', 'purchase_order'),
  postPurchaseOrderCancel
);

export default router;
