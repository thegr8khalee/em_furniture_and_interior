import express from 'express';
import {
  getRevenueSummary,
  exportRevenueCsv,
} from '../controllers/finance.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { exportLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get(
  '/admin/revenue',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FINANCE_VIEW]),
  getRevenueSummary
);

router.get(
  '/admin/revenue/export',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FINANCE_VIEW]),
  exportLimiter,
  exportRevenueCsv
);

export default router;
