import express from 'express';
import {
  getOneStaff,
  getStaffList,
  patchStaff,
  postStaffDeactivation,
} from '../controllers/staff.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// Everything here is `staff.manage`, which no role list grants — so only
// super_admin holds it. Handing out access is an owner's decision, and reading
// the list is not meaningfully separable from it: the list is the map of who
// can do what.
router.use(protectAdminRoute, requirePermissions([PERMISSIONS.STAFF_MANAGE]));

router.get('/', getStaffList);
router.get('/:staffId', getOneStaff);

// Both audited. A role change and a deactivation are the two events an audit
// trail exists to be able to answer for.
router.patch('/:staffId', createAuditLog('PERMISSION_CHANGE', 'staff'), patchStaff);
router.post(
  '/:staffId/deactivate',
  createAuditLog('STATUS_CHANGE', 'staff'),
  postStaffDeactivation
);

export default router;
