import express from 'express';
import {
  getAuditLogs,
  getAuditLogStats,
  getActivityLogs,
  getActivityLogStats,
  cleanupAuditLogs,
} from '../controllers/logs.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// All logs routes require admin authentication
router.use(protectAdminRoute);

// Audit logs (requires FINANCE_VIEW permission for security monitoring)
router.get('/audit', requirePermissions([PERMISSIONS.FINANCE_VIEW]), getAuditLogs);
router.get('/audit/stats', requirePermissions([PERMISSIONS.FINANCE_VIEW]), getAuditLogStats);
router.post('/audit/cleanup', requirePermissions([PERMISSIONS.FINANCE_VIEW]), cleanupAuditLogs);

// Activity logs (requires FINANCE_VIEW for analytics access)
router.get('/activity', requirePermissions([PERMISSIONS.FINANCE_VIEW]), getActivityLogs);
router.get('/activity/stats', requirePermissions([PERMISSIONS.FINANCE_VIEW]), getActivityLogStats);

export default router;
