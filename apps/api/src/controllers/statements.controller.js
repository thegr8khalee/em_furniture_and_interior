import { logger } from '../lib/logger.js';
import { StatementError, customerStatement, statementRun } from '../services/statements.js';
import { toCsv, sendCsv } from '../lib/csv.js';
import { parseRange, cashFlow, trialBalance, vatReturn, listEntries } from '../services/books.js';

/*
 * Documents that leave the building: a statement for a customer, and figures in
 * a form somebody else's software can read.
 */

const fail = (error, res, where) => {
  if (error instanceof StatementError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getStatement = async (req, res) => {
  try {
    const statement = await customerStatement(req.params.customerId, {
      from: req.query.from || null,
      to: req.query.to || null,
    });

    res.json({ success: true, statement });
  } catch (error) {
    fail(error, res, 'Error building a statement');
  }
};

export const getStatementCsv = async (req, res) => {
  try {
    const statement = await customerStatement(req.params.customerId, {
      from: req.query.from || null,
      to: req.query.to || null,
    });

    const csv = toCsv(
      [
        { key: 'date', label: 'Date' },
        { key: 'reference', label: 'Reference' },
        { key: 'kind', label: 'Type' },
        { key: 'charged', label: 'Charged' },
        { key: 'paid', label: 'Paid' },
        { key: 'balance', label: 'Balance' },
      ],
      statement.lines
    );

    sendCsv(res, `statement-${statement.customer.name.replace(/\s+/g, '-')}.csv`, csv);
  } catch (error) {
    fail(error, res, 'Error exporting a statement');
  }
};

export const getStatementRun = async (req, res) => {
  try {
    res.json({ success: true, ...(await statementRun({ asOf: req.query.asOf || null })) });
  } catch (error) {
    fail(error, res, 'Error listing statements to send');
  }
};

/**
 * The VAT return as a file.
 *
 * Filing means giving figures to somebody else, and a report that can only be
 * read on a screen has to be retyped to be filed.
 */
export const getVatCsv = async (req, res) => {
  try {
    const range = parseRange(req.query.from, req.query.to);
    if (!range) return res.status(400).json({ message: 'Invalid date range.' });

    const vat = await vatReturn(range);

    const csv = toCsv(
      [
        { key: 'item', label: 'Item' },
        { key: 'amount', label: 'Amount' },
      ],
      [
        { item: 'Period from', amount: vat.from },
        { item: 'Period to', amount: vat.to },
        { item: 'Taxable sales', amount: vat.taxableSales },
        { item: 'Output VAT (charged on sales)', amount: vat.outputVat },
        { item: 'Input VAT (paid on purchases)', amount: vat.inputVat },
        { item: 'Net payable', amount: vat.netPayable },
      ]
    );

    sendCsv(res, `vat-${vat.from}-to-${vat.to}.csv`, csv);
  } catch (error) {
    fail(error, res, 'Error exporting the VAT return');
  }
};

/** The trial balance, for an accountant's own working papers. */
export const getTrialBalanceCsv = async (req, res) => {
  try {
    const balance = await trialBalance({ asOf: req.query.asOf || null });

    const csv = toCsv(
      [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Account' },
        { key: 'type', label: 'Type' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
        { key: 'balance', label: 'Balance' },
      ],
      balance.accounts
    );

    sendCsv(res, `trial-balance-${balance.asOf ?? 'today'}.csv`, csv);
  } catch (error) {
    fail(error, res, 'Error exporting the trial balance');
  }
};

/**
 * The journal, for handing over a period's books.
 *
 * Capped rather than unbounded: an export that times out halfway produces a
 * file that looks complete and is not, which is worse than a refusal.
 */
export const getJournalCsv = async (req, res) => {
  try {
    const { entries } = await listEntries({
      page: 1,
      limit: 5000,
      from: req.query.from || null,
      to: req.query.to || null,
      source: req.query.source || null,
    });

    const csv = toCsv(
      [
        { key: 'entryNumber', label: 'Entry' },
        { key: 'date', label: 'Date' },
        { key: 'description', label: 'Description' },
        { key: 'source', label: 'Source' },
        { key: 'total', label: 'Amount' },
      ],
      entries
    );

    sendCsv(res, 'journal.csv', csv);
  } catch (error) {
    fail(error, res, 'Error exporting the journal');
  }
};

/** Where the cash went, as a file. */
export const getCashFlowCsv = async (req, res) => {
  try {
    const range = parseRange(req.query.from, req.query.to);
    if (!range) return res.status(400).json({ message: 'Invalid date range.' });

    const flow = await cashFlow(range);

    const rows = [
      { section: '', item: 'Cash at the start', amount: flow.openingBalance },
      ...flow.operating.lines.map((line) => ({
        section: 'Operating',
        item: `${line.code} ${line.name}`,
        amount: line.amount,
      })),
      { section: 'Operating', item: 'Total operating', amount: flow.operating.total },
      ...flow.investing.lines.map((line) => ({
        section: 'Investing',
        item: `${line.code} ${line.name}`,
        amount: line.amount,
      })),
      { section: 'Investing', item: 'Total investing', amount: flow.investing.total },
      ...flow.financing.lines.map((line) => ({
        section: 'Financing',
        item: `${line.code} ${line.name}`,
        amount: line.amount,
      })),
      { section: 'Financing', item: 'Total financing', amount: flow.financing.total },
      { section: '', item: 'Net change', amount: flow.netChange },
      { section: '', item: 'Cash at the end', amount: flow.closingBalance },
    ];

    const csv = toCsv(
      [
        { key: 'section', label: 'Section' },
        { key: 'item', label: 'Item' },
        { key: 'amount', label: 'Amount' },
      ],
      rows
    );

    sendCsv(res, `cash-flow-${flow.from}-to-${flow.to}.csv`, csv);
  } catch (error) {
    fail(error, res, 'Error exporting the cash flow');
  }
};
