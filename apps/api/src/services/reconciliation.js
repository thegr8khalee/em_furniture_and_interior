import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';

/**
 * Does the bank agree?
 *
 * The ledger says what the business thinks it has. The bank says what it
 * actually has. The two drift for ordinary reasons — a transfer entered twice, a
 * charge nobody recorded, a cheque not yet presented, a customer payment that
 * arrived quietly — and a cash figure nobody has checked against the bank is a
 * guess with a decimal point.
 *
 * Reconciling is matching one side against the other until what is left over
 * explains the difference. What is left over is the useful part: an unmatched
 * bank line is something the books have not heard about, and an unmatched
 * posting is something the bank has not processed.
 */

export class ReconciliationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ReconciliationError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/** The cash accounts. Anything else cannot be reconciled against a statement. */
const CASH_ACCOUNTS = ['1110', '1120', '1130'];

const accountByCode = async (db, code, opts) => {
  if (!CASH_ACCOUNTS.includes(String(code))) {
    throw new ReconciliationError(
      `${code} is not a bank or cash account. Only ${CASH_ACCOUNTS.join(', ')} can be reconciled.`
    );
  }

  const account = await selectOne(
    db,
    'SELECT id, code, name FROM accounts WHERE code = :code',
    { code },
    opts
  );
  if (!account) throw new ReconciliationError(`No account ${code}.`, 404);
  return account;
};

/**
 * Records lines from a statement.
 *
 * Importing the same statement twice is the most common way a reconciliation
 * goes wrong, because it reconciles doubled data and the totals still look
 * plausible. A line carrying the bank's own reference is unique per account, so
 * a re-import updates nothing and adds nothing; a line without one is taken at
 * face value, because some statements do not provide one.
 */
export const importStatement = async (
  { accountCode, lines },
  db = getSequelize()
) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ReconciliationError('There are no lines to import.');
  }

  const account = await accountByCode(db, accountCode);

  const prepared = lines.map((line, index) => {
    const amount = toMinor(Number(line.amount));

    if (!line.date) throw new ReconciliationError(`Line ${index + 1} has no date.`);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ReconciliationError(`Line ${index + 1} has no amount.`);
    }
    if (line.direction !== 'in' && line.direction !== 'out') {
      throw new ReconciliationError(
        `Line ${index + 1} must say whether the money came in or went out.`
      );
    }

    return {
      date: line.date,
      description: line.description || 'Bank line',
      amount,
      direction: line.direction,
      reference: line.reference || null,
      bankReference: line.bankReference || null,
    };
  });

  let imported = 0;
  let duplicates = 0;

  await db.transaction(async (transaction) => {
    for (const line of prepared) {
      const row = await selectOne(
        db,
        `INSERT INTO bank_statement_lines
           (account_id, entry_date, description, amount, direction, reference, bank_reference)
         VALUES (:accountId, :date::date, :description, :amount, :direction::bank_line_direction,
                 :reference, :bankReference)
         ON CONFLICT (account_id, bank_reference) DO NOTHING
         RETURNING id`,
        { accountId: account.id, ...line },
        { transaction }
      );

      if (row) imported += 1;
      else duplicates += 1;
    }
  });

  return { account: account.code, imported, duplicates };
};

/**
 * The working view: both sides, with what is matched and what is not.
 *
 * The unmatched columns are the point of the screen. Everything matched has
 * already been agreed and is only shown so the totals add up.
 */
export const workspace = async (
  { accountCode = '1120', asOf = null } = {},
  db = getSequelize()
) => {
  const account = await accountByCode(db, accountCode);
  const date = asOf ?? new Date().toISOString().slice(0, 10);

  const statement = await select(
    db,
    `SELECT id, entry_date, description, amount, direction::text, reference,
            matched_entry_id, matched_at
       FROM bank_statement_lines
      WHERE account_id = :accountId AND entry_date <= :asOf::date
      ORDER BY entry_date, imported_at`,
    { accountId: account.id, asOf: date }
  );

  // Every posting that touched this account, with the movement it made and
  // whether a statement line has claimed it.
  const postings = await select(
    db,
    `SELECT e.id, e.entry_number, e.entry_date, e.description, e.source::text,
            (SUM(l.debit) - SUM(l.credit))::bigint AS movement,
            EXISTS (
              SELECT 1 FROM bank_statement_lines b WHERE b.matched_entry_id = e.id
            ) AS matched
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
      WHERE l.account_id = :accountId AND e.entry_date <= :asOf::date
      GROUP BY e.id, e.entry_number, e.entry_date, e.description, e.source
      HAVING SUM(l.debit) - SUM(l.credit) <> 0
      ORDER BY e.entry_date, e.entry_number`,
    { accountId: account.id, asOf: date }
  );

  const ledgerBalance = postings.reduce((total, row) => total + Number(row.movement), 0);

  const asLine = (row) => ({
    _id: row.id,
    date: row.entry_date,
    description: row.description,
    amount: money(row.amount),
    direction: row.direction,
    reference: row.reference,
    matchedEntryId: row.matched_entry_id,
    isMatched: Boolean(row.matched_entry_id),
  });

  const asPosting = (row) => ({
    _id: row.id,
    entryNumber: row.entry_number,
    date: row.entry_date,
    description: row.description,
    source: row.source,
    // Signed: positive is money into the account.
    movement: money(row.movement),
    isMatched: row.matched,
  });

  const statementLines = statement.map(asLine);
  const ledgerLines = postings.map(asPosting);

  // What the bank has that the books have not, and the other way round. These
  // two are the reconciliation: whatever they come to has to explain the gap.
  const unmatchedStatement = statementLines.filter((line) => !line.isMatched);
  const unmatchedLedger = ledgerLines.filter((line) => !line.isMatched);

  const unrecorded = unmatchedStatement.reduce(
    (total, line) => total + (line.direction === 'in' ? Number(line.amount) : -Number(line.amount)),
    0
  );
  const unpresented = unmatchedLedger.reduce((total, line) => total + Number(line.movement), 0);

  const statementBalance = statementLines.reduce(
    (total, line) => total + (line.direction === 'in' ? Number(line.amount) : -Number(line.amount)),
    0
  );

  return {
    account: { code: account.code, name: account.name },
    asOf: date,
    ledgerBalance: money(ledgerBalance),
    // What the imported lines come to. Only the same as the real bank balance
    // when the whole statement history has been imported, which is why the
    // figure the reconciliation is signed off against is typed in by hand.
    importedBalance: statementBalance,
    statement: statementLines,
    ledger: ledgerLines,
    unmatched: {
      // On the bank and not in the books: charges, interest, a payment nobody
      // recorded.
      statement: unmatchedStatement,
      unrecorded,
      // In the books and not on the bank: a cheque not yet presented, a
      // transfer still in flight.
      ledger: unmatchedLedger,
      unpresented,
    },
    // If every line were matched, these would agree.
    difference: money(ledgerBalance) - statementBalance + unrecorded - unpresented,
  };
};

/**
 * Agrees one bank line against one posting.
 *
 * One posting answers for one line: matching the same posting twice would
 * reconcile a balance that never existed, which a unique index refuses rather
 * than trusting the caller.
 */
export const matchLine = async (lineId, entryId, staffId = null, db = getSequelize()) => {
  if (!isValidId(String(lineId ?? ''))) throw new ReconciliationError('Line not found.', 404);
  if (!isValidId(String(entryId ?? ''))) throw new ReconciliationError('Entry not found.', 404);

  const line = await selectOne(
    db,
    `SELECT b.id, b.account_id, b.amount, b.direction::text, b.matched_entry_id
       FROM bank_statement_lines b WHERE b.id = :lineId`,
    { lineId }
  );
  if (!line) throw new ReconciliationError('Line not found.', 404);
  if (line.matched_entry_id) throw new ReconciliationError('That line is already matched.');

  const posting = await selectOne(
    db,
    `SELECT e.id, (SUM(l.debit) - SUM(l.credit))::bigint AS movement
       FROM journal_entries e
       JOIN journal_lines l ON l.entry_id = e.id
      WHERE e.id = :entryId AND l.account_id = :accountId
      GROUP BY e.id`,
    { entryId, accountId: line.account_id }
  );

  if (!posting) {
    throw new ReconciliationError('That entry does not touch this account.');
  }

  // The amounts have to agree, and so do the directions. Matching ₦5,000 in
  // against ₦5,000 out would reconcile to nothing while hiding a ₦10,000 error.
  const expected = line.direction === 'in' ? Number(line.amount) : -Number(line.amount);
  if (Number(posting.movement) !== expected) {
    throw new ReconciliationError(
      `These do not agree: the bank says ${money(expected)} and the entry says ${money(
        posting.movement
      )}.`
    );
  }

  await db.query(
    `UPDATE bank_statement_lines
        SET matched_entry_id = :entryId, matched_at = now(), matched_by = :staffId
      WHERE id = :lineId`,
    {
      replacements: {
        lineId,
        entryId,
        staffId: isValidId(String(staffId ?? '')) ? staffId : null,
      },
    }
  ).catch((error) => {
    if (`${error?.original?.constraint}`.includes('one_entry_each')) {
      throw new ReconciliationError('That entry is already matched to another line.');
    }
    throw error;
  });

  return { lineId, entryId, matched: true };
};

/** Undoes a match, for when the wrong two things were put together. */
export const unmatchLine = async (lineId, db = getSequelize()) => {
  if (!isValidId(String(lineId ?? ''))) throw new ReconciliationError('Line not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE bank_statement_lines
        SET matched_entry_id = NULL, matched_at = NULL, matched_by = NULL
      WHERE id = :lineId AND matched_entry_id IS NOT NULL
      RETURNING id`,
    { lineId }
  );

  if (!row) throw new ReconciliationError('That line was not matched.', 404);
  return { lineId, matched: false };
};

/**
 * Suggests what goes with what.
 *
 * Same amount, same direction, within a few days. It suggests rather than
 * matches, because two payments of the same amount in the same week are common
 * and a wrong match is worse than no match — it agrees a balance that was never
 * true and hides the error underneath.
 */
export const suggestMatches = async (
  { accountCode = '1120', toleranceDays = 5 } = {},
  db = getSequelize()
) => {
  const account = await accountByCode(db, accountCode);

  const rows = await select(
    db,
    `WITH unmatched_lines AS (
       SELECT id, entry_date, amount, direction, description
         FROM bank_statement_lines
        WHERE account_id = :accountId AND matched_entry_id IS NULL
     ),
     unmatched_entries AS (
       SELECT e.id, e.entry_number, e.entry_date, e.description,
              (SUM(l.debit) - SUM(l.credit))::bigint AS movement
         FROM journal_entries e
         JOIN journal_lines l ON l.entry_id = e.id
        WHERE l.account_id = :accountId
          AND NOT EXISTS (
            SELECT 1 FROM bank_statement_lines b WHERE b.matched_entry_id = e.id
          )
        GROUP BY e.id, e.entry_number, e.entry_date, e.description
       HAVING SUM(l.debit) - SUM(l.credit) <> 0
     )
     SELECT l.id AS line_id, l.entry_date AS line_date, l.description AS line_description,
            l.amount, l.direction::text,
            e.id AS entry_id, e.entry_number, e.entry_date AS entry_date,
            e.description AS entry_description,
            abs(l.entry_date - e.entry_date) AS days_apart
       FROM unmatched_lines l
       JOIN unmatched_entries e
         ON e.movement = CASE WHEN l.direction = 'in' THEN l.amount ELSE -l.amount END
        AND abs(l.entry_date - e.entry_date) <= :tolerance
      ORDER BY days_apart, l.entry_date`,
    { accountId: account.id, tolerance: Number(toleranceDays) || 5 }
  );

  // One suggestion per line and per entry: offering the same posting for two
  // lines invites exactly the double match the index refuses.
  const usedLines = new Set();
  const usedEntries = new Set();
  const suggestions = [];

  for (const row of rows) {
    if (usedLines.has(row.line_id) || usedEntries.has(row.entry_id)) continue;

    usedLines.add(row.line_id);
    usedEntries.add(row.entry_id);

    suggestions.push({
      lineId: row.line_id,
      entryId: row.entry_id,
      amount: money(row.amount),
      direction: row.direction,
      daysApart: Number(row.days_apart),
      line: { date: row.line_date, description: row.line_description },
      entry: {
        entryNumber: row.entry_number,
        date: row.entry_date,
        description: row.entry_description,
      },
    });
  }

  return { account: account.code, suggestions };
};

/**
 * Signs off a reconciliation.
 *
 * The statement balance is typed in rather than computed from the imported
 * lines: the point of the exercise is to check the books against something
 * outside them, and checking them against a number derived from what was
 * imported would only prove the import was self-consistent.
 */
export const completeReconciliation = async (
  { accountCode, statementDate, statementBalance, notes = null },
  staffId = null,
  db = getSequelize()
) => {
  const account = await accountByCode(db, accountCode);

  if (!statementDate) throw new ReconciliationError('Which date does the statement end on?');

  const closing = toMinor(Number(statementBalance));
  if (!Number.isFinite(closing)) {
    throw new ReconciliationError('What does the bank say the balance is?');
  }

  const view = await workspace({ accountCode, asOf: statementDate }, db);

  const ledger = toMinor(Number(view.ledgerBalance));
  const unpresented = toMinor(Number(view.unmatched.unpresented));
  const unrecorded = toMinor(Number(view.unmatched.unrecorded));

  // The books, less what the bank has not seen, plus what the books have not
  // seen, should be the bank's own figure. Anything else is an error somebody
  // has to find — and signing off a reconciliation that does not reconcile is
  // how an error becomes permanent.
  const reconciled = ledger - unpresented + unrecorded;

  if (reconciled !== closing) {
    throw new ReconciliationError(
      `This does not reconcile. The books say ${money(ledger)}, and after ${money(
        unpresented
      )} not yet on the bank and ${money(unrecorded)} not yet in the books that comes to ${money(
        reconciled
      )} — but the statement says ${money(closing)}, a difference of ${money(
        reconciled - closing
      )}.`
    );
  }

  const row = await selectOne(
    db,
    `INSERT INTO bank_reconciliations
       (account_id, statement_date, statement_balance, ledger_balance,
        unpresented, unrecorded, notes, completed_by)
     VALUES (:accountId, :statementDate::date, :closing, :ledger, :unpresented, :unrecorded,
             :notes, :staffId)
     ON CONFLICT (account_id, statement_date) DO NOTHING
     RETURNING id, statement_date, completed_at`,
    {
      accountId: account.id,
      statementDate,
      closing,
      ledger,
      unpresented,
      unrecorded,
      notes,
      staffId: isValidId(String(staffId ?? '')) ? staffId : null,
    }
  );

  if (!row) {
    throw new ReconciliationError(
      `${account.code} has already been reconciled to ${statementDate}.`
    );
  }

  return {
    _id: row.id,
    account: account.code,
    statementDate: row.statement_date,
    statementBalance: money(closing),
    ledgerBalance: money(ledger),
    unpresented: money(unpresented),
    unrecorded: money(unrecorded),
    completedAt: row.completed_at,
  };
};

/** What has been reconciled, and when. */
export const listReconciliations = async ({ accountCode = null } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT r.id, r.statement_date, r.statement_balance, r.ledger_balance,
            r.unpresented, r.unrecorded, r.notes, r.completed_at,
            a.code AS account_code, s.username AS completed_by_name
       FROM bank_reconciliations r
       JOIN accounts a ON a.id = r.account_id
       LEFT JOIN staff s ON s.id = r.completed_by
      ${accountCode ? 'WHERE a.code = :accountCode' : ''}
      ORDER BY r.statement_date DESC`,
    { accountCode }
  );

  return rows.map((row) => ({
    _id: row.id,
    account: row.account_code,
    statementDate: row.statement_date,
    statementBalance: money(row.statement_balance),
    ledgerBalance: money(row.ledger_balance),
    unpresented: money(row.unpresented),
    unrecorded: money(row.unrecorded),
    notes: row.notes,
    completedBy: row.completed_by_name,
    completedAt: row.completed_at,
  }));
};
