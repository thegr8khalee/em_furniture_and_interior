import express from 'express';
import {
  getCustomerAddresses,
  getCustomerStats,
  getCustomers,
  getOneCustomer,
  postLoyaltyAdjustment,
} from '../controllers/customers.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// A customer list is the most personal data in the system — names, addresses,
// phone numbers and what everyone has spent. Console only, and behind a
// permission of its own rather than the dashboard's.
router.use(protectAdminRoute);

const canRead = requirePermissions([PERMISSIONS.CUSTOMERS_VIEW]);

router.get('/', canRead, getCustomers);
router.get('/stats', canRead, getCustomerStats);
router.get('/:customerId', canRead, getOneCustomer);
router.get('/:customerId/addresses', canRead, getCustomerAddresses);

// The one thing an operator may change about a customer, and it is audited:
// points are money, and a balance that moved for no recorded reason is the
// thing a loyalty scheme cannot survive.
router.post(
  '/:customerId/loyalty',
  canRead,
  createAuditLog('UPDATE', 'customer_loyalty'),
  postLoyaltyAdjustment
);

export default router;
