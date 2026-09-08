import express from 'express';
import {
  getLocations,
  getOneStockTake,
  getReorderSuggestions,
  getStockByLocation,
  getStockTakes,
  patchLocation,
  postLocation,
  postStockTake,
  postStockTakeAbandonment,
  postStockTakeApplication,
  postTransfer,
  putCounts,
} from '../controllers/warehouse.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// All of it is stock work, so all of it is inventory.manage.
router.use(protectAdminRoute, requirePermissions([PERMISSIONS.INVENTORY_MANAGE]));

router.get('/locations', getLocations);
router.post('/locations', createAuditLog('CREATE', 'stock_location'), postLocation);
router.patch('/locations/:locationId', createAuditLog('UPDATE', 'stock_location'), patchLocation);

router.get('/stock', getStockByLocation);

// Two movements, written together. Nothing posts — the value did not change.
router.post('/transfers', createAuditLog('CREATE', 'stock_transfer'), postTransfer);

router.get('/stock-takes', getStockTakes);
router.get('/stock-takes/:takeId', getOneStockTake);
router.post('/stock-takes', createAuditLog('CREATE', 'stock_take'), postStockTake);
router.put('/stock-takes/:takeId/counts', putCounts);

// Applying writes one adjustment per difference, and each one posts.
router.post(
  '/stock-takes/:takeId/apply',
  createAuditLog('STATUS_CHANGE', 'stock_take'),
  postStockTakeApplication
);
router.post(
  '/stock-takes/:takeId/abandon',
  createAuditLog('STATUS_CHANGE', 'stock_take'),
  postStockTakeAbandonment
);

router.get('/reorder', getReorderSuggestions);

export default router;
