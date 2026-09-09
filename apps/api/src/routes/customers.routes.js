import express from 'express';
import {
  getCustomerAddresses,
  getCustomerStats,
  getCustomers,
  getOneCustomer,
  patchCustomer,
  postCustomer,
  postLoyaltyAdjustment,
  removeCustomer,
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

// The shop was the only door: an account could be created by somebody signing
// up on the website and no other way, so a walk-in who wanted an invoice could
// not be recorded at all. Adding one is the same permission as reading them —
// whoever answers the phone is the person who needs to write the name down.
router.post('/', canRead, createAuditLog('CREATE', 'customer'), postCustomer);
router.patch('/:customerId', canRead, createAuditLog('UPDATE', 'customer'), patchCustomer);
router.delete('/:customerId', canRead, createAuditLog('DELETE', 'customer'), removeCustomer);

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
