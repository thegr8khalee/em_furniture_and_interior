import express from 'express';
import {
  getActiveDesigners,
  getAllDesigners,
  createDesigner,
  updateDesigner,
  deleteDesigner,
} from '../controllers/designer.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.get('/', getActiveDesigners);

router.get(
  '/admin',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.DESIGNERS_MANAGE]),
  getAllDesigners
);

router.post(
  '/admin',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.DESIGNERS_MANAGE]),
  createAuditLog('CREATE', 'designer'),
  createDesigner
);

router.put(
  '/admin/:designerId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.DESIGNERS_MANAGE]),
  createAuditLog('UPDATE', 'designer'),
  updateDesigner
);

router.delete(
  '/admin/:designerId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.DESIGNERS_MANAGE]),
  createAuditLog('DELETE', 'designer'),
  deleteDesigner
);

export default router;
