import express from 'express';
import {
  getCashFlowCsv,
  getJournalCsv,
  getStatement,
  getStatementCsv,
  getStatementRun,
  getTrialBalanceCsv,
  getVatCsv,
} from '../controllers/statements.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { exportLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(protectAdminRoute, requirePermissions([PERMISSIONS.FINANCE_VIEW]));

// What one customer owes and what it is for. The ageing answers the owner's
// question; this answers the customer's.
router.get('/customers/:customerId', getStatement);
router.get('/customers/:customerId.csv', exportLimiter, getStatementCsv);

// Everyone with something outstanding, so statements go out together rather
// than one at a time — which is how they stop going out at all.
router.get('/run', getStatementRun);

// Figures in a form somebody else's software can read. Retyping is where the
// errors come from.
router.get('/exports/vat.csv', exportLimiter, getVatCsv);
router.get('/exports/trial-balance.csv', exportLimiter, getTrialBalanceCsv);
router.get('/exports/journal.csv', exportLimiter, getJournalCsv);
router.get('/exports/cash-flow.csv', exportLimiter, getCashFlowCsv);

export default router;
