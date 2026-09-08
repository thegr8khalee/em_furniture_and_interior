import { logger } from '../lib/logger.js';
import {
  ReconciliationError,
  completeReconciliation,
  importStatement,
  listReconciliations,
  matchLine,
  suggestMatches,
  unmatchLine,
  workspace,
} from '../services/reconciliation.js';

/*
 * Checking the books against the bank.
 *
 * The useful part of this is what is left unmatched: a bank line nothing
 * accounts for is something the books have not heard about, and a posting the
 * bank has not seen is money still in flight.
 */

const fail = (error, res, where) => {
  if (error instanceof ReconciliationError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getWorkspace = async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await workspace({
        accountCode: req.query.account || '1120',
        asOf: req.query.asOf || null,
      })),
    });
  } catch (error) {
    fail(error, res, 'Error loading the reconciliation');
  }
};

export const postStatement = async (req, res) => {
  try {
    const result = await importStatement({
      accountCode: req.body?.account || '1120',
      lines: req.body?.lines,
    });

    res.status(201).json({
      success: true,
      ...result,
      message: result.duplicates
        ? `${result.imported} imported, ${result.duplicates} already there.`
        : `${result.imported} lines imported.`,
    });
  } catch (error) {
    fail(error, res, 'Error importing a statement');
  }
};

export const getSuggestions = async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await suggestMatches({
        accountCode: req.query.account || '1120',
        toleranceDays: req.query.days || 5,
      })),
    });
  } catch (error) {
    fail(error, res, 'Error suggesting matches');
  }
};

export const postMatch = async (req, res) => {
  try {
    const result = await matchLine(req.params.lineId, req.body?.entryId, req.admin?.id ?? null);
    res.json({ success: true, ...result, message: 'Matched.' });
  } catch (error) {
    fail(error, res, 'Error matching a line');
  }
};

export const deleteMatch = async (req, res) => {
  try {
    const result = await unmatchLine(req.params.lineId);
    res.json({ success: true, ...result, message: 'Unmatched.' });
  } catch (error) {
    fail(error, res, 'Error unmatching a line');
  }
};

export const postCompletion = async (req, res) => {
  try {
    const reconciliation = await completeReconciliation(
      {
        accountCode: req.body?.account || '1120',
        statementDate: req.body?.statementDate,
        statementBalance: req.body?.statementBalance,
        notes: req.body?.notes || null,
      },
      req.admin?.id ?? null
    );

    res.status(201).json({
      success: true,
      reconciliation,
      message: `${reconciliation.account} agrees with the bank to ${reconciliation.statementDate}.`,
    });
  } catch (error) {
    fail(error, res, 'Error completing a reconciliation');
  }
};

export const getReconciliations = async (req, res) => {
  try {
    res.json({
      success: true,
      reconciliations: await listReconciliations({ accountCode: req.query.account || null }),
    });
  } catch (error) {
    fail(error, res, 'Error listing reconciliations');
  }
};
