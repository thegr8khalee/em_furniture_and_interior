import { logger } from '../lib/logger.js';
import {
  PayrollError,
  addEmployee,
  approvePayRun,
  createPayRun,
  discardPayRun,
  getPayRun,
  listEmployees,
  listPayRuns,
  payPayRun,
  updateEmployee,
} from '../services/payroll.js';

/*
 * Payroll. The people, the monthly run, and the three debts approving one
 * creates — to the staff, to FIRS, and to the pension fund.
 */

const fail = (error, res, where) => {
  if (error instanceof PayrollError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getEmployees = async (req, res) => {
  try {
    res.json({ success: true, ...(await listEmployees({ currentOnly: req.query.current === 'true' })) });
  } catch (error) {
    fail(error, res, 'Error listing employees');
  }
};

export const postEmployee = async (req, res) => {
  try {
    res.status(201).json({ success: true, employee: await addEmployee(req.body) });
  } catch (error) {
    fail(error, res, 'Error adding an employee');
  }
};

export const patchEmployee = async (req, res) => {
  try {
    res.json({ success: true, employee: await updateEmployee(req.params.employeeId, req.body) });
  } catch (error) {
    fail(error, res, 'Error updating an employee');
  }
};

export const getPayRuns = async (req, res) => {
  try {
    res.json({ success: true, payRuns: await listPayRuns() });
  } catch (error) {
    fail(error, res, 'Error listing pay runs');
  }
};

export const getOnePayRun = async (req, res) => {
  try {
    res.json({ success: true, payRun: await getPayRun(req.params.runId) });
  } catch (error) {
    fail(error, res, 'Error loading a pay run');
  }
};

export const postPayRunDraft = async (req, res) => {
  try {
    const payRun = await createPayRun({ month: req.body?.month || null });

    res.status(201).json({
      success: true,
      payRun,
      message: `Draft for ${String(payRun.period).slice(0, 7)}: ${payRun.headcount} on the payroll.`,
    });
  } catch (error) {
    fail(error, res, 'Error building a pay run');
  }
};

export const postPayRunApproval = async (req, res) => {
  try {
    const payRun = await approvePayRun(req.params.runId, req.admin?.id ?? null);

    res.json({
      success: true,
      payRun,
      message: 'Approved. The wages, the tax and the pension are now owed.',
    });
  } catch (error) {
    fail(error, res, 'Error approving a pay run');
  }
};

export const postPayRunPayment = async (req, res) => {
  try {
    const payRun = await payPayRun(req.params.runId, {
      paymentMethod: req.body?.paymentMethod,
      paidOn: req.body?.paidOn || null,
    });

    res.json({
      success: true,
      payRun,
      message: 'Net wages paid. The tax and the pension are still owed until remitted.',
    });
  } catch (error) {
    fail(error, res, 'Error paying a pay run');
  }
};

export const deletePayRun = async (req, res) => {
  try {
    await discardPayRun(req.params.runId);
    res.json({ success: true, message: 'Draft discarded.' });
  } catch (error) {
    fail(error, res, 'Error discarding a pay run');
  }
};
