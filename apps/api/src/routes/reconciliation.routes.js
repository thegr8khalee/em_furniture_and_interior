import express from 'express';
import {
  deleteMatch,
  getReconciliations,
  getSuggestions,
  getWorkspace,
  postCompletion,
  postMatch,
  postStatement,
} from '../controllers/reconciliation.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.use(protectAdminRoute);

const canRead = requirePermissions([PERMISSIONS.FINANCE_VIEW]);
// Signing off that the books agree with the bank is the owner's assertion.
const canReconcile = requirePermissions([PERMISSIONS.BOOKS_MANAGE]);

router.get('/', canRead, getWorkspace);
router.get('/suggestions', canRead, getSuggestions);
router.get('/history', canRead, getReconciliations);

// A statement can be long; app.js gives this prefix the larger body parser.
router.post('/statement', canReconcile, createAuditLog('CREATE', 'bank_statement'), postStatement);

router.post('/lines/:lineId/match', canReconcile, postMatch);
router.delete('/lines/:lineId/match', canReconcile, deleteMatch);

router.post('/complete', canReconcile, createAuditLog('CREATE', 'bank_reconciliation'), postCompletion);

export default router;
