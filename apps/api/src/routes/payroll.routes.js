import express from 'express';
import {
  deletePayRun,
  getEmployees,
  getOnePayRun,
  getPayRuns,
  patchEmployee,
  postEmployee,
  postPayRunApproval,
  postPayRunDraft,
  postPayRunPayment,
  generatePayslipDocument,
  postPayRunTaxRemittance,
  postPayRunPensionRemittance,
} from '../controllers/payroll.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// What people are paid is the most sensitive figure in the business, and
// approving a run creates three debts. All of it is the owner's: `books.manage`,
// which no role list grants.
router.use(protectAdminRoute, requirePermissions([PERMISSIONS.BOOKS_MANAGE]));

router.get('/employees', getEmployees);
router.post('/employees', createAuditLog('CREATE', 'employee'), postEmployee);
router.patch('/employees/:employeeId', createAuditLog('UPDATE', 'employee'), patchEmployee);

router.get('/runs', getPayRuns);
router.get('/runs/:runId', getOnePayRun);
router.post('/runs', createAuditLog('CREATE', 'pay_run'), postPayRunDraft);

// Printable employee payslip
router.get('/runs/:runId/payslips/:slipId/pdf', generatePayslipDocument);

// Approving is what makes the money owed; paying settles only the net.
router.post('/runs/:runId/approve', createAuditLog('STATUS_CHANGE', 'pay_run'), postPayRunApproval);
router.post('/runs/:runId/pay', createAuditLog('STATUS_CHANGE', 'pay_run'), postPayRunPayment);

// Remitting tax and pension settles accounts 2500 and 2600 against the bank.
router.post(
  '/runs/:runId/remit-tax',
  createAuditLog('STATUS_CHANGE', 'pay_run'),
  postPayRunTaxRemittance
);
router.post(
  '/runs/:runId/remit-pension',
  createAuditLog('STATUS_CHANGE', 'pay_run'),
  postPayRunPensionRemittance
);

router.delete('/runs/:runId', createAuditLog('DELETE', 'pay_run'), deletePayRun);

export default router;
