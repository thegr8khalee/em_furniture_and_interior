import express from 'express';
import {
  getInventoryProducts,
  adjustInventory,
  getInventoryHistory,
} from '../controllers/inventory.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.get(
  '/admin/products',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  getInventoryProducts
);

// Why a count is what it is: the movements the balance is derived from. This
// is what the separate InventoryAdjustment collection used to describe.
router.get(
  '/admin/products/:productId/history',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  getInventoryHistory
);

router.put(
  '/admin/products/:productId/adjust',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  createAuditLog('UPDATE', 'inventory'),
  adjustInventory
);

export default router;
