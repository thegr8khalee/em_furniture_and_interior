import express from 'express';
import {
  getInventoryProducts,
  adjustInventory,
} from '../controllers/inventory.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.get(
  '/admin/products',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  getInventoryProducts
);

router.put(
  '/admin/products/:productId/adjust',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  createAuditLog('UPDATE', 'inventory'),
  adjustInventory
);

export default router;
