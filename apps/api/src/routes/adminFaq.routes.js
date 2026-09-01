import express from 'express';
import {
  adminListFAQs,
  createFAQ,
  deleteFAQ,
  updateFAQ,
} from '../controllers/faq.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.get(
  '/',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FAQ_MANAGE]),
  adminListFAQs
);
router.post(
  '/',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FAQ_MANAGE]),
  createAuditLog('CREATE', 'faq'),
  createFAQ
);
router.put(
  '/:id',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FAQ_MANAGE]),
  createAuditLog('UPDATE', 'faq'),
  updateFAQ
);
router.delete(
  '/:id',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FAQ_MANAGE]),
  createAuditLog('DELETE', 'faq'),
  deleteFAQ
);

export default router;
