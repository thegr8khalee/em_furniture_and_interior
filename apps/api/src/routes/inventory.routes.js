import express from 'express';
import {
  getInventoryProducts,
  getOneInventoryProduct,
  adjustInventory,
  getInventoryHistory,
  putCostPrice,
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

// One product's position, so its own page does not have to search for it.
router.get(
  '/admin/products/:productId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  getOneInventoryProduct
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

// A sale posts a cost of goods sold only if the product has a cost price, so
// this is the control that makes the profit and loss mean anything.
router.put(
  '/admin/products/:productId/cost',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.INVENTORY_MANAGE]),
  createAuditLog('UPDATE', 'product'),
  putCostPrice
);

export default router;
