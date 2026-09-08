import express from 'express';
import {
  getAssets,
  getOneAsset,
  postAsset,
  postAssetDisposal,
  postDepreciationRun,
} from '../controllers/assets.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.use(protectAdminRoute);

const canRead = requirePermissions([PERMISSIONS.FINANCE_VIEW]);
// Capitalising something is a decision about what counts as an asset rather
// than an expense, and it changes reported profit — so it sits with the money
// permissions, not with inventory.
const canManage = requirePermissions([PERMISSIONS.BOOKS_MANAGE]);

router.get('/', canRead, getAssets);
router.get('/:assetId', canRead, getOneAsset);

router.post('/', canManage, createAuditLog('CREATE', 'fixed_asset'), postAsset);

// Run once a month. Running it twice charges nothing twice.
router.post('/depreciation', canManage, createAuditLog('CREATE', 'depreciation'), postDepreciationRun);

router.post(
  '/:assetId/dispose',
  canManage,
  createAuditLog('STATUS_CHANGE', 'fixed_asset'),
  postAssetDisposal
);

export default router;
