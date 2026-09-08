import express from 'express';
import {
  getAccountLedger,
  getCashFlow,
  getAccounts,
  getBalanceSheet,
  getJournal,
  getJournalEntry,
  getPeriods,
  getProfitAndLoss,
  getReceivables,
  getTrialBalance,
  getVatReturn,
  postClosePeriod,
  postReopenPeriod,
} from '../controllers/books.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// The books are the whole business's figures, so every route here is behind the
// console and the finance permission.
router.use(protectAdminRoute);

const canRead = requirePermissions([PERMISSIONS.FINANCE_VIEW]);

// --- the ledger ------------------------------------------------------------
router.get('/trial-balance', canRead, getTrialBalance);
router.get('/journal', canRead, getJournal);
router.get('/journal/:entryId', canRead, getJournalEntry);
router.get('/accounts', canRead, getAccounts);
router.get('/accounts/:code/ledger', canRead, getAccountLedger);

// --- reports ---------------------------------------------------------------
router.get('/reports/profit-and-loss', canRead, getProfitAndLoss);
router.get('/reports/balance-sheet', canRead, getBalanceSheet);
router.get('/reports/vat', canRead, getVatReturn);
router.get('/reports/cash-flow', canRead, getCashFlow);

// Who owes us. The payables ageing lives on the purchasing side; this is its
// mirror, and it is built from orders rather than journal lines because a
// receivable is owed by someone and a journal line deliberately carries no
// customer.
router.get('/receivables', canRead, getReceivables);

// --- periods ---------------------------------------------------------------
//
// Reading the calendar is a finance question; closing a month is an owner's
// decision, so it needs `books.manage`, which only super_admin holds. Both
// changes are audited: a month closing and reopening quietly is exactly what an
// audit trail exists to prevent.
router.get('/periods', canRead, getPeriods);

router.post(
  '/periods/:periodId/close',
  requirePermissions([PERMISSIONS.BOOKS_MANAGE]),
  createAuditLog('STATUS_CHANGE', 'accounting_period'),
  postClosePeriod
);

router.post(
  '/periods/:periodId/reopen',
  requirePermissions([PERMISSIONS.BOOKS_MANAGE]),
  createAuditLog('STATUS_CHANGE', 'accounting_period'),
  postReopenPeriod
);

export default router;
