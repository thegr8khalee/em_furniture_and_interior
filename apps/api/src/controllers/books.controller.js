import { logger } from '../lib/logger.js';
import {
  BooksError,
  accountLedger,
  balanceSheet,
  cashFlow,
  closePeriod,
  getEntry,
  listAccounts,
  listEntries,
  listPeriods,
  parseRange,
  postManualEntry,
  profitAndLoss,
  receivablesAgeing,
  reverseJournalEntry,
  reopenPeriod,
  trialBalance,
  vatReturn,
} from '../services/books.js';

/*
 * The books, for reading — and the one control that changes them, which is
 * closing a period.
 *
 * Everything here derives from `journal_lines`. Nothing recomputes a figure
 * from orders or payments: that is what makes the reports and the postings
 * incapable of disagreeing.
 */

const fail = (error, res, where) => {
  if (error instanceof BooksError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

const withRange = (load, where) => async (req, res) => {
  const range = parseRange(req.query.from, req.query.to);
  if (!range) return res.status(400).json({ message: 'Invalid date range.' });

  try {
    res.json({ success: true, ...(await load(range, req)) });
  } catch (error) {
    fail(error, res, where);
  }
};

export const getTrialBalance = async (req, res) => {
  try {
    res.json({ success: true, ...(await trialBalance({ asOf: req.query.asOf || null })) });
  } catch (error) {
    fail(error, res, 'Error building the trial balance');
  }
};

export const getJournal = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

  try {
    const { entries, total } = await listEntries({
      page,
      limit,
      source: req.query.source || null,
      from: req.query.from || null,
      to: req.query.to || null,
      account: req.query.account || null,
    });

    res.json({
      success: true,
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error listing journal entries');
  }
};

export const getJournalEntry = async (req, res) => {
  try {
    res.json({ success: true, entry: await getEntry(req.params.entryId) });
  } catch (error) {
    fail(error, res, 'Error reading a journal entry');
  }
};

export const getAccounts = async (req, res) => {
  try {
    res.json({ success: true, accounts: await listAccounts({ asOf: req.query.asOf || null }) });
  } catch (error) {
    fail(error, res, 'Error listing accounts');
  }
};

export const getAccountLedger = async (req, res) => {
  try {
    const ledger = await accountLedger(req.params.code, {
      from: req.query.from || null,
      to: req.query.to || null,
    });
    res.json({ success: true, ...ledger });
  } catch (error) {
    fail(error, res, 'Error reading an account ledger');
  }
};

export const getPeriods = async (req, res) => {
  try {
    res.json({ success: true, periods: await listPeriods({ all: req.query.all === 'true' }) });
  } catch (error) {
    fail(error, res, 'Error listing accounting periods');
  }
};

export const postClosePeriod = async (req, res) => {
  try {
    const period = await closePeriod(req.params.periodId, req.admin.id);
    res.json({ success: true, message: `${period.name} is closed.`, period });
  } catch (error) {
    fail(error, res, 'Error closing an accounting period');
  }
};

export const postReopenPeriod = async (req, res) => {
  try {
    const period = await reopenPeriod(req.params.periodId);
    res.json({ success: true, message: `${period.name} is open again.`, period });
  } catch (error) {
    fail(error, res, 'Error reopening an accounting period');
  }
};

export const getProfitAndLoss = withRange(
  (range) => profitAndLoss(range),
  'Error building the profit and loss'
);

export const getBalanceSheet = async (req, res) => {
  try {
    res.json({ success: true, ...(await balanceSheet({ asOf: req.query.asOf || null })) });
  } catch (error) {
    fail(error, res, 'Error building the balance sheet');
  }
};

export const getVatReturn = withRange((range) => vatReturn(range), 'Error building the VAT return');

/**
 * Who owes the business money, and for how long.
 *
 * The mirror of the payables ageing on the purchasing side, which existed while
 * this did not — so `1200` carried a balance nothing could break down.
 */
export const getReceivables = async (req, res) => {
  try {
    res.json({ success: true, ...(await receivablesAgeing({ asOf: req.query.asOf || null })) });
  } catch (error) {
    fail(error, res, 'Error building the receivables ageing');
  }
};

/**
 * Where the cash went.
 *
 * The third statement. A profitable month can still empty the bank if the
 * profit went into stock, and neither of the other two reports can show that.
 */
export const getCashFlow = withRange((range) => cashFlow(range), 'Error building the cash flow');

/**
 * An entry posted by hand.
 *
 * Month-end lives here: a prepayment, an accrual, depreciation, a correction.
 * The posting rules cover what the business does routinely and leave all of
 * that with no way in.
 */
export const postJournalEntry = async (req, res) => {
  try {
    const entry = await postManualEntry(
      {
        date: req.body?.date,
        description: req.body?.description,
        reference: req.body?.reference || null,
        lines: req.body?.lines,
      },
      req.admin?.id ?? null
    );

    res.status(201).json({ success: true, entry, message: `${entry.entryNumber} posted.` });
  } catch (error) {
    fail(error, res, 'Error posting a manual entry');
  }
};

/** The only way to undo something that is in the books. */
export const postJournalReversal = async (req, res) => {
  try {
    const entry = await reverseJournalEntry(
      req.params.entryId,
      { reason: req.body?.reason || null },
      req.admin?.id ?? null
    );

    res.status(201).json({
      success: true,
      entry,
      message: `${entry.entryNumber} reverses it. Both stay in the books.`,
    });
  } catch (error) {
    fail(error, res, 'Error reversing an entry');
  }
};
