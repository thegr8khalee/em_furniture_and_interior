import { QueryTypes } from 'sequelize';
import { assertMinor, sumMinor } from '../lib/money.js';
import { logger } from '../lib/logger.js';

/**
 * Posting to the general ledger.
 *
 * Every amount that moves through the business ends up here, so this is the one
 * function that must not be worked around. Two rules it exists to enforce
 * before the database gets a chance to:
 *
 *   - an entry is written in a single transaction, or not at all. A journal
 *     entry that half-posts corrupts the books in a way that is tedious to
 *     unpick and easy to miss.
 *   - the amounts are already whole minor units. The database rounds a
 *     fractional input silently (see lib/money.js), so a discount computed as
 *     33.333% has to be resolved here, not left to the cast.
 */

export class LedgerError extends Error {}

const NUMBER_PREFIX = 'JE';

/**
 * Resolves account codes to ids in one query.
 *
 * Codes rather than ids at the call site: a posting rule that reads
 * `debit: '1200'` next to `credit: '4100'` can be checked against the chart of
 * accounts by someone who does not have the database open.
 */
const resolveAccounts = async (db, codes, transaction) => {
  const rows = await db.query(
    'SELECT id, code, is_postable FROM accounts WHERE code IN (:codes)',
    { replacements: { codes }, type: QueryTypes.SELECT, transaction }
  );

  const byCode = new Map(rows.map((r) => [r.code, r]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) {
    throw new LedgerError(`Unknown account code(s): ${missing.join(', ')}`);
  }

  const summary = codes.filter((c) => !byCode.get(c).is_postable);
  if (summary.length) {
    throw new LedgerError(
      `Cannot post to summary account(s): ${summary.join(', ')}. Post to a leaf account.`
    );
  }

  return byCode;
};

const validateLines = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new LedgerError('A journal entry needs at least two lines');
  }

  lines.forEach((line, i) => {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;

    assertMinor(debit, `line ${i + 1} debit`);
    assertMinor(credit, `line ${i + 1} credit`);

    if (debit < 0 || credit < 0) {
      throw new LedgerError(
        `Line ${i + 1} has a negative amount. A negative debit is a credit — write it as one.`
      );
    }
    if ((debit > 0) === (credit > 0)) {
      throw new LedgerError(
        `Line ${i + 1} must be exactly one of a debit or a credit, not ${
          debit > 0 ? 'both' : 'neither'
        }.`
      );
    }
    if (!line.account) {
      throw new LedgerError(`Line ${i + 1} names no account`);
    }
  });

  const debits = sumMinor(lines.map((l) => l.debit ?? 0));
  const credits = sumMinor(lines.map((l) => l.credit ?? 0));

  if (debits !== credits) {
    // The database enforces this too, at commit. Checking here means the error
    // names the entry being built rather than surfacing as a deferred trigger
    // failure with no application context.
    throw new LedgerError(
      `Entry does not balance: debits ${debits}, credits ${credits} (out by ${debits - credits})`
    );
  }
  if (debits === 0) {
    throw new LedgerError('Entry has no value');
  }

  return { debits, credits };
};

/**
 * Posts a journal entry.
 *
 * Pass an existing `transaction` to post as part of a larger unit of work —
 * confirming a payment should record the payment and its posting together, or
 * neither.
 */
export const postEntry = async (
  db,
  { date, description, source = 'manual', sourceId = null, lines, createdBy = null, reverses = null },
  { transaction: outerTransaction } = {}
) => {
  if (!date) throw new LedgerError('An entry needs a date');
  if (!description) throw new LedgerError('An entry needs a description');

  const { debits } = validateLines(lines);

  const run = async (transaction) => {
    const codes = [...new Set(lines.map((l) => l.account))];
    const accounts = await resolveAccounts(db, codes, transaction);

    const [[counter]] = await db.query('SELECT next_number(:name) AS value', {
      replacements: { name: 'journal_entry' },
      transaction,
    });
    const entryNumber = `${NUMBER_PREFIX}-${String(counter.value).padStart(6, '0')}`;

    const [[entry]] = await db.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description, source, source_id, created_by, reverses_id)
       VALUES (:entryNumber, :date, :description, :source, :sourceId, :createdBy, :reverses)
       RETURNING id, entry_number`,
      {
        replacements: { entryNumber, date, description, source, sourceId, createdBy, reverses },
        transaction,
      }
    );

    for (const line of lines) {
      await db.query(
        `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
         VALUES (:entryId, :accountId, :debit, :credit, :lineDescription)`,
        {
          replacements: {
            entryId: entry.id,
            accountId: accounts.get(line.account).id,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            lineDescription: line.description ?? null,
          },
          transaction,
        }
      );
    }

    logger.info(
      { entryNumber: entry.entry_number, source, sourceId, amount: debits },
      'Posted journal entry'
    );

    return { id: entry.id, entryNumber: entry.entry_number, amount: debits };
  };

  return outerTransaction ? run(outerTransaction) : db.transaction(run);
};

/**
 * Reverses a posted entry.
 *
 * The only way to undo a posting. Editing or deleting one is refused by the
 * database, so a correction leaves both the original and its reversal on the
 * record — which is the difference between a ledger and a spreadsheet.
 */
export const reverseEntry = async (db, entryId, { date, description, createdBy = null } = {}) =>
  db.transaction(async (transaction) => {
    const [original] = await db.query(
      `SELECT e.id, e.entry_number, e.entry_date, e.description
       FROM journal_entries e WHERE e.id = :entryId`,
      { replacements: { entryId }, type: QueryTypes.SELECT, transaction }
    );

    if (!original) {
      throw new LedgerError(`No journal entry ${entryId}`);
    }

    const [existing] = await db.query(
      'SELECT entry_number FROM journal_entries WHERE reverses_id = :entryId',
      { replacements: { entryId }, type: QueryTypes.SELECT, transaction }
    );
    if (existing) {
      throw new LedgerError(
        `Entry ${original.entry_number} was already reversed by ${existing.entry_number}`
      );
    }

    const lines = await db.query(
      `SELECT a.code AS account, l.debit, l.credit, l.description
       FROM journal_lines l JOIN accounts a ON a.id = l.account_id
       WHERE l.entry_id = :entryId`,
      { replacements: { entryId }, type: QueryTypes.SELECT, transaction }
    );

    // Debits become credits and back again. The reversal is dated today, not on
    // the original's date, which may sit inside a period that is now closed.
    const mirrored = lines.map((line) => ({
      account: line.account,
      debit: Number(line.credit),
      credit: Number(line.debit),
      description: line.description,
    }));

    return postEntry(
      db,
      {
        date: date || new Date().toISOString().slice(0, 10),
        description: description || `Reversal of ${original.entry_number}: ${original.description}`,
        source: 'manual',
        createdBy,
        reverses: entryId,
        lines: mirrored,
      },
      { transaction }
    );
  });

/** The trial balance as of a date. Debits and credits must come out equal. */
export const trialBalance = async (db, { asOf = null } = {}) => {
  const rows = await db.query(
    `SELECT a.code, a.name, a.type, a.normal_balance,
            COALESCE(SUM(l.debit), 0)::bigint  AS total_debit,
            COALESCE(SUM(l.credit), 0)::bigint AS total_credit
     FROM accounts a
     LEFT JOIN journal_lines l ON l.account_id = a.id
     LEFT JOIN journal_entries e ON e.id = l.entry_id
       AND (:asOf::date IS NULL OR e.entry_date <= :asOf::date)
     WHERE a.is_postable
     GROUP BY a.code, a.name, a.type, a.normal_balance
     HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
     ORDER BY a.code`,
    { replacements: { asOf }, type: QueryTypes.SELECT }
  );

  const accounts = rows.map((r) => {
    const debit = Number(r.total_debit);
    const credit = Number(r.total_credit);
    return {
      ...r,
      total_debit: debit,
      total_credit: credit,
      balance: r.normal_balance === 'debit' ? debit - credit : credit - debit,
    };
  });

  const totalDebit = accounts.reduce((n, a) => n + a.total_debit, 0);
  const totalCredit = accounts.reduce((n, a) => n + a.total_credit, 0);

  return { accounts, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
};
