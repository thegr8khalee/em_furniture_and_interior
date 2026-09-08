import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor } from '../lib/money.js';
import { trialBalance as ledgerTrialBalance } from './ledger.js';

/**
 * Reading the books.
 *
 * The ledger has been posting to since orders moved to PostgreSQL, and until
 * now nothing could see it: `trialBalance` existed as a function with no route,
 * and the only finance screen showed a sum over the orders table — a sales
 * report, which cannot express a cost, a liability or a bank balance. This is
 * the read side.
 *
 * Everything here derives from `journal_lines`. Nothing recomputes a figure
 * from orders or payments, because the whole point of a ledger is that the
 * reports and the postings cannot disagree. If a number here looks wrong, the
 * posting rule is wrong, and that is a better place to look.
 *
 * Amounts are kobo in the database and naira on the wire, as everywhere else.
 */

export class BooksError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'BooksError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/**
 * The window a report covers.
 *
 * Defaults to the current financial year to date, because that is the question
 * an owner asks without qualifying it.
 */
export const parseRange = (from, to) => {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(Date.UTC(end.getUTCFullYear(), 0, 1));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start > end) return null;

  return { start, end };
};

const asDate = (value) => value.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// The ledger itself
// ---------------------------------------------------------------------------

export const trialBalance = async ({ asOf = null } = {}, db = getSequelize()) => {
  const result = await ledgerTrialBalance(db, { asOf });

  return {
    asOf,
    balanced: result.balanced,
    totalDebit: money(result.totalDebit),
    totalCredit: money(result.totalCredit),
    accounts: result.accounts.map((account) => ({
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normal_balance,
      debit: money(account.total_debit),
      credit: money(account.total_credit),
      balance: money(account.balance),
    })),
  };
};

const publicEntry = (row) => ({
  _id: row.id,
  entryNumber: row.entry_number,
  date: row.entry_date,
  description: row.description,
  source: row.source,
  sourceId: row.source_id,
  reversesId: row.reverses_id,
  reversedById: row.reversed_by_id ?? null,
  createdBy: row.created_by,
  createdByName: row.created_by_name ?? null,
  createdAt: row.created_at,
  total: money(row.total),
});

const ENTRY_SELECT = `
  SELECT e.id, e.entry_number, e.entry_date, e.description, e.source, e.source_id,
         e.reverses_id, e.created_by, e.created_at,
         s.username AS created_by_name,
         (SELECT id FROM journal_entries r WHERE r.reverses_id = e.id) AS reversed_by_id,
         COALESCE((SELECT SUM(debit) FROM journal_lines WHERE entry_id = e.id), 0)::bigint AS total
    FROM journal_entries e
    LEFT JOIN staff s ON s.id = e.created_by
`;

/** The journal: every entry, newest first, filterable the way an auditor asks. */
export const listEntries = async (
  { page = 1, limit = 50, source = null, from = null, to = null, account = null } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (source) {
    where.push('e.source = :source::journal_source');
    replacements.source = source;
  }
  if (from) {
    where.push('e.entry_date >= :from::date');
    replacements.from = from;
  }
  if (to) {
    where.push('e.entry_date <= :to::date');
    replacements.to = to;
  }
  if (account) {
    where.push(`EXISTS (
      SELECT 1 FROM journal_lines l JOIN accounts a ON a.id = l.account_id
       WHERE l.entry_id = e.id AND a.code = :account
    )`);
    replacements.account = account;
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `${ENTRY_SELECT} ${filter}
      ORDER BY e.entry_date DESC, e.entry_number DESC
      LIMIT :limit OFFSET :offset`,
    replacements
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM journal_entries e ${filter}`,
    replacements
  );

  return { entries: rows.map(publicEntry), total: counted.total };
};

/** One entry, with the lines that make it up. */
export const getEntry = async (entryId, db = getSequelize()) => {
  if (!isValidId(String(entryId ?? ''))) throw new BooksError('Entry not found.', 404);

  const row = await selectOne(db, `${ENTRY_SELECT} WHERE e.id = :entryId`, { entryId });
  if (!row) throw new BooksError('Entry not found.', 404);

  const lines = await select(
    db,
    `SELECT a.code, a.name, l.debit::bigint AS debit, l.credit::bigint AS credit, l.description
       FROM journal_lines l
       JOIN accounts a ON a.id = l.account_id
      WHERE l.entry_id = :entryId
      ORDER BY l.debit DESC, a.code`,
    { entryId }
  );

  return {
    ...publicEntry(row),
    lines: lines.map((line) => ({
      account: line.code,
      accountName: line.name,
      debit: money(line.debit),
      credit: money(line.credit),
      description: line.description,
    })),
  };
};

/** The chart of accounts, each with what it currently holds. */
export const listAccounts = async ({ asOf = null } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    // Same shape as the trial balance: the cut-off is inside the sums, because
    // on the join it leaves the line counted and filters nothing.
    `SELECT a.code, a.name, a.type, a.normal_balance, a.is_postable, a.is_active,
            COALESCE(SUM(CASE WHEN :asOf::date IS NULL OR e.entry_date <= :asOf::date
                              THEN l.debit ELSE 0 END), 0)::bigint  AS debit,
            COALESCE(SUM(CASE WHEN :asOf::date IS NULL OR e.entry_date <= :asOf::date
                              THEN l.credit ELSE 0 END), 0)::bigint AS credit
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       LEFT JOIN journal_entries e ON e.id = l.entry_id
      GROUP BY a.code, a.name, a.type, a.normal_balance, a.is_postable, a.is_active
      ORDER BY a.code`,
    { asOf }
  );

  return rows.map((row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    return {
      code: row.code,
      name: row.name,
      type: row.type,
      normalBalance: row.normal_balance,
      isPostable: row.is_postable,
      isActive: row.is_active,
      debit: money(debit),
      credit: money(credit),
      balance: money(row.normal_balance === 'debit' ? debit - credit : credit - debit),
    };
  });
};

/** What one account did, line by line, with a running balance. */
export const accountLedger = async (
  code,
  { from = null, to = null, limit = 200 } = {},
  db = getSequelize()
) => {
  const account = await selectOne(
    db,
    'SELECT code, name, type, normal_balance FROM accounts WHERE code = :code',
    { code }
  );
  if (!account) throw new BooksError(`No account ${code}.`, 404);

  const sign = account.normal_balance === 'debit' ? 1 : -1;

  const opening = await selectOne(
    db,
    `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0)::bigint AS net
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      -- Only what precedes the window. With no start date nothing precedes it,
      -- so the opening balance is zero. Written the other way round, a null
      -- start made every line count as "before the start" and opened the
      -- account with its own closing balance.
      WHERE a.code = :code AND :from::date IS NOT NULL AND e.entry_date < :from::date`,
    { code, from }
  );

  const rows = await select(
    db,
    `SELECT e.entry_number, e.entry_date, e.description, e.source,
            l.debit::bigint AS debit, l.credit::bigint AS credit, l.description AS line_description
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE a.code = :code
        AND (:from::date IS NULL OR e.entry_date >= :from::date)
        AND (:to::date IS NULL OR e.entry_date <= :to::date)
      ORDER BY e.entry_date, e.entry_number
      LIMIT :limit`,
    { code, from, to, limit }
  );

  let running = Number(opening.net) * sign;

  const lines = rows.map((row) => {
    running += (Number(row.debit) - Number(row.credit)) * sign;
    return {
      entryNumber: row.entry_number,
      date: row.entry_date,
      description: row.line_description || row.description,
      source: row.source,
      debit: money(row.debit),
      credit: money(row.credit),
      balance: money(running),
    };
  });

  return {
    account: {
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normal_balance,
    },
    openingBalance: money(Number(opening.net) * sign),
    closingBalance: money(running),
    lines,
  };
};

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

const publicPeriod = (row) => ({
  _id: row.id,
  name: row.name,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  status: row.status,
  closedAt: row.closed_at,
  closedBy: row.closed_by,
  entryCount: row.entry_count ?? undefined,
});

/**
 * The accounting calendar, and what has been posted into each month.
 *
 * Only months that have something in them, or that are near enough to now to
 * matter — the calendar runs to 2035 and listing every empty month of it would
 * bury the ones anybody is going to close.
 */
export const listPeriods = async ({ all = false } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT p.id, p.name, p.starts_on, p.ends_on, p.status, p.closed_at, p.closed_by,
            count(e.id)::int AS entry_count
       FROM accounting_periods p
       LEFT JOIN journal_entries e ON e.entry_date BETWEEN p.starts_on AND p.ends_on
      GROUP BY p.id
      ${all ? '' : `HAVING count(e.id) > 0
         OR p.status = 'closed'
         OR p.starts_on <= CURRENT_DATE + interval '2 months'
        AND p.ends_on >= CURRENT_DATE - interval '12 months'`}
      ORDER BY p.starts_on DESC`
  );

  return rows.map(publicPeriod);
};

/**
 * Closes a month.
 *
 * `assert_period_open` refuses a posting into a closed period, so this is the
 * control that stops last month's figures moving after they have been reported.
 * It is not a lock on the data — a correction is still possible, by reopening
 * deliberately, which leaves a trace in `closed_at` rather than happening
 * quietly.
 */
export const closePeriod = async (periodId, staffId, db = getSequelize()) => {
  if (!isValidId(String(periodId ?? ''))) throw new BooksError('Period not found.', 404);

  const period = await selectOne(
    db,
    'SELECT id, name, status, ends_on FROM accounting_periods WHERE id = :periodId',
    { periodId }
  );
  if (!period) throw new BooksError('Period not found.', 404);
  if (period.status === 'closed') throw new BooksError(`${period.name} is already closed.`);

  // Closing a month that has not finished would refuse postings for days that
  // have not happened yet.
  const [{ finished }] = await select(
    db,
    'SELECT (:endsOn::date < CURRENT_DATE) AS finished',
    { endsOn: period.ends_on }
  );
  if (!finished) {
    throw new BooksError(`${period.name} has not finished yet.`);
  }

  const row = await selectOne(
    db,
    `UPDATE accounting_periods
        SET status = 'closed', closed_at = now(), closed_by = :staffId
      WHERE id = :periodId
      RETURNING id, name, starts_on, ends_on, status, closed_at, closed_by`,
    { periodId, staffId: isValidId(String(staffId ?? '')) ? staffId : null }
  );

  return publicPeriod(row);
};

export const reopenPeriod = async (periodId, db = getSequelize()) => {
  if (!isValidId(String(periodId ?? ''))) throw new BooksError('Period not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL
      WHERE id = :periodId
      RETURNING id, name, starts_on, ends_on, status, closed_at, closed_by`,
    { periodId }
  );

  if (!row) throw new BooksError('Period not found.', 404);
  return publicPeriod(row);
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Movement on a set of account types over a window.
 *
 * Revenue and expense accounts are period figures — what happened between two
 * dates — which is what makes them a profit and loss rather than a balance.
 */
const movement = async (db, types, range) =>
  select(
    db,
    `SELECT a.code, a.name, a.type,
            (CASE WHEN a.normal_balance = 'debit'
                  THEN SUM(l.debit) - SUM(l.credit)
                  ELSE SUM(l.credit) - SUM(l.debit) END)::bigint AS amount
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE a.type IN (:types)
        AND e.entry_date >= :from::date AND e.entry_date <= :to::date
      GROUP BY a.code, a.name, a.type, a.normal_balance
     HAVING SUM(l.debit) <> 0 OR SUM(l.credit) <> 0
      ORDER BY a.code`,
    { types, from: asDate(range.start), to: asDate(range.end) }
  );

const asLines = (rows) =>
  rows.map((row) => ({ code: row.code, name: row.name, amount: money(row.amount) }));

const sum = (rows) => rows.reduce((total, row) => total + Number(row.amount), 0);

/**
 * Profit and loss for a window.
 *
 * Cost of sales is separated from the other expenses so gross profit means
 * something. `5100` is the cost of goods sold that the stock postings write;
 * everything else under 5000 is an operating cost.
 */
export const profitAndLoss = async (range, db = getSequelize()) => {
  const [revenue, expenses] = await Promise.all([
    movement(db, ['revenue'], range),
    movement(db, ['expense'], range),
  ]);

  const costOfSales = expenses.filter((row) => row.code === '5100');
  const operating = expenses.filter((row) => row.code !== '5100');

  const revenueTotal = sum(revenue);
  const costTotal = sum(costOfSales);
  const operatingTotal = sum(operating);

  return {
    from: asDate(range.start),
    to: asDate(range.end),
    revenue: { lines: asLines(revenue), total: money(revenueTotal) },
    costOfSales: { lines: asLines(costOfSales), total: money(costTotal) },
    grossProfit: money(revenueTotal - costTotal),
    operatingExpenses: { lines: asLines(operating), total: money(operatingTotal) },
    netProfit: money(revenueTotal - costTotal - operatingTotal),
  };
};

/**
 * The balance sheet as at a date.
 *
 * Assets, liabilities and equity are cumulative — everything ever posted up to
 * the date — and the accounting equation has to hold. Retained earnings are not
 * an account anybody posts to here: they are revenue less expenses to date, so
 * the sheet balances without a year-end closing entry having been made.
 */
export const balanceSheet = async ({ asOf = null } = {}, db = getSequelize()) => {
  const date = asOf ?? asDate(new Date());

  const rows = await select(
    db,
    `SELECT a.code, a.name, a.type,
            (CASE WHEN a.normal_balance = 'debit'
                  THEN SUM(l.debit) - SUM(l.credit)
                  ELSE SUM(l.credit) - SUM(l.debit) END)::bigint AS amount
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE e.entry_date <= :asOf::date
      GROUP BY a.code, a.name, a.type, a.normal_balance
     HAVING SUM(l.debit) <> 0 OR SUM(l.credit) <> 0
      ORDER BY a.code`,
    { asOf: date }
  );

  const of = (type) => rows.filter((row) => row.type === type);

  const assets = of('asset');
  const liabilities = of('liability');
  const equity = of('equity');
  const earned = sum(of('revenue')) - sum(of('expense'));

  const assetTotal = sum(assets);
  const liabilityTotal = sum(liabilities);
  const equityTotal = sum(equity) + earned;

  return {
    asOf: date,
    assets: { lines: asLines(assets), total: money(assetTotal) },
    liabilities: { lines: asLines(liabilities), total: money(liabilityTotal) },
    equity: {
      lines: [
        ...asLines(equity),
        { code: '3200', name: 'Retained earnings', amount: money(earned) },
      ],
      total: money(equityTotal),
    },
    // Assets = liabilities + equity, or something is posted wrongly. Publishing
    // the check rather than assuming it means a broken posting rule shows up on
    // the screen instead of in a reconciliation months later.
    balanced: assetTotal === liabilityTotal + equityTotal,
  };
};

/**
 * The VAT return.
 *
 * Output VAT is what was charged to customers — the credit side of `2200`.
 * Input VAT is what was paid to suppliers, the debit side, which an approved
 * expense writes. The net is what is owed to the revenue service, or
 * reclaimable from it when purchases carried more VAT than sales did.
 */
export const vatReturn = async (range, db = getSequelize()) => {
  const [row] = await select(
    db,
    `SELECT COALESCE(SUM(l.credit), 0)::bigint AS output_vat,
            COALESCE(SUM(l.debit), 0)::bigint  AS input_vat
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE a.code = '2200'
        AND e.entry_date >= :from::date AND e.entry_date <= :to::date`,
    { from: asDate(range.start), to: asDate(range.end) }
  );

  const [sales] = await select(
    db,
    `SELECT COALESCE(SUM(l.credit) - SUM(l.debit), 0)::bigint AS net
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE a.type = 'revenue'
        AND e.entry_date >= :from::date AND e.entry_date <= :to::date`,
    { from: asDate(range.start), to: asDate(range.end) }
  );

  const output = Number(row.output_vat);
  const input = Number(row.input_vat);

  return {
    from: asDate(range.start),
    to: asDate(range.end),
    taxableSales: money(sales.net),
    outputVat: money(output),
    inputVat: money(input),
    // Positive is owed to the revenue service; negative is reclaimable.
    netPayable: money(output - input),
  };
};

/**
 * Who owes the business money, and for how long.
 *
 * The mirror of the payables ageing, which existed while this did not: `1200`
 * carried a balance that no report could break down, so "who owes us?" — the
 * question that decides who gets chased this week — had no answer.
 *
 * Built from the orders rather than from `journal_lines`, because a receivable
 * is owed *by someone* and the ledger deliberately does not carry a customer on
 * a journal line. The two agree by construction: an order is owed exactly when
 * its sale has been recognised and the money has not arrived, which is the same
 * condition that leaves a balance in `1200`.
 */
export const receivablesAgeing = async ({ asOf = null } = {}, db = getSequelize()) => {
  const date = asOf ?? asDate(new Date());

  const rows = await select(
    db,
    `WITH owed AS (
       SELECT o.id,
              o.order_number,
              o.created_at::date AS owed_since,
              o.total_amount
                - COALESCE((SELECT SUM(t.amount - t.refunded_amount)
                              FROM payment_transactions t
                             WHERE t.order_id = o.id
                               AND t.status IN ('success', 'refunded')), 0)
                - COALESCE((SELECT SUM(r.amount) FROM order_refunds r
                             WHERE r.order_id = o.id), 0) AS outstanding,
              COALESCE(c.id::text, 'guest-' || o.id::text) AS payer_key,
              COALESCE(c.full_name, o.shipping_address->>'fullName', 'Guest') AS payer_name,
              c.id AS customer_id,
              COALESCE(c.email, o.shipping_address->>'email') AS email
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.created_at::date <= :asOf::date
          -- Only what the books have recognised. An unconfirmed order is not
          -- owed yet, however much it is worth.
          AND EXISTS (SELECT 1 FROM journal_entries e
                       WHERE e.source = 'sales_order' AND e.source_id = o.id)
          AND o.status <> 'cancelled'
     )
     SELECT payer_key, payer_name, customer_id, email,
            SUM(outstanding)::bigint AS total,
            COALESCE(SUM(outstanding) FILTER (
              WHERE owed_since > :asOf::date - 30), 0)::bigint AS current,
            COALESCE(SUM(outstanding) FILTER (
              WHERE owed_since <= :asOf::date - 30
                AND owed_since > :asOf::date - 60), 0)::bigint AS thirty,
            COALESCE(SUM(outstanding) FILTER (
              WHERE owed_since <= :asOf::date - 60
                AND owed_since > :asOf::date - 90), 0)::bigint AS sixty,
            COALESCE(SUM(outstanding) FILTER (
              WHERE owed_since <= :asOf::date - 90), 0)::bigint AS ninety,
            json_agg(json_build_object(
              'orderNumber', order_number, 'owedSince', owed_since,
              'outstanding', outstanding
            ) ORDER BY owed_since) AS orders
       FROM owed
      WHERE outstanding > 0
      GROUP BY payer_key, payer_name, customer_id, email
      ORDER BY total DESC`,
    { asOf: date }
  );

  const customers = rows.map((row) => ({
    customerId: row.customer_id,
    name: row.payer_name,
    email: row.email,
    total: money(row.total),
    current: money(row.current),
    thirtyDays: money(row.thirty),
    sixtyDays: money(row.sixty),
    ninetyDaysPlus: money(row.ninety),
    orders: (row.orders ?? []).map((order) => ({
      orderNumber: order.orderNumber,
      owedSince: order.owedSince,
      outstanding: money(order.outstanding),
    })),
  }));

  const sum = (key) => customers.reduce((total, row) => total + Number(row[key]), 0);

  return {
    asOf: date,
    customers,
    totals: {
      total: sum('total'),
      current: sum('current'),
      thirtyDays: sum('thirtyDays'),
      sixtyDays: sum('sixtyDays'),
      ninetyDaysPlus: sum('ninetyDaysPlus'),
    },
  };
};

/**
 * Where the cash actually went.
 *
 * The third statement, and the one a small business feels first: a profitable
 * month can still empty the bank if the profit went into stock. The profit and
 * loss cannot show that and the balance sheet only shows the endpoints.
 *
 * Built by the **direct method** — every movement on a cash account, classified
 * by what the other side of its entry was. The indirect method would start from
 * profit and adjust, which is harder to check and harder to explain; here every
 * figure is a sum of real cash lines and the total is provably the change in the
 * bank.
 *
 * The classification is by the counterpart account, which is what makes it
 * honest: cash paired with revenue or a receivable is operating, cash paired
 * with equity is financing, cash paired with a fixed asset would be investing.
 */
export const cashFlow = async (range, db = getSequelize()) => {
  const from = asDate(range.start);
  const to = asDate(range.end);

  const opening = await selectOne(
    db,
    `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0)::bigint AS balance
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
      WHERE a.code IN ('1110', '1120', '1130') AND e.entry_date < :from::date`,
    { from }
  );

  // Each cash line, with the accounts on the other side of the same entry.
  const rows = await select(
    db,
    `SELECT cash.entry_id,
            (cash.debit - cash.credit)::bigint AS movement,
            other.type::text AS counterpart_type,
            other.code AS counterpart_code,
            other.name AS counterpart_name,
            (other.debit + other.credit)::bigint AS counterpart_weight
       FROM (
         SELECT l.entry_id, l.debit, l.credit
           FROM journal_lines l
           JOIN journal_entries e ON e.id = l.entry_id
           JOIN accounts a ON a.id = l.account_id
          WHERE a.code IN ('1110', '1120', '1130')
            AND e.entry_date >= :from::date AND e.entry_date <= :to::date
       ) cash
       JOIN LATERAL (
         SELECT a2.type, a2.code, a2.name, l2.debit, l2.credit
           FROM journal_lines l2
           JOIN accounts a2 ON a2.id = l2.account_id
          WHERE l2.entry_id = cash.entry_id
            AND a2.code NOT IN ('1110', '1120', '1130')
       ) other ON true`,
    { from, to }
  );

  // An entry can have several non-cash lines — a sale has revenue and VAT — so
  // the cash is split across them in proportion to what they carry. Without
  // this a single line would claim the whole movement and every other
  // classification would double-count it.
  const weights = new Map();
  for (const row of rows) {
    const key = row.entry_id;
    weights.set(key, (weights.get(key) ?? 0) + Number(row.counterpart_weight));
  }

  const buckets = { operating: new Map(), investing: new Map(), financing: new Map() };

  const activityOf = (type, code) => {
    if (type === 'equity') return 'financing';
    // Long-term borrowings would be financing too; the chart has none yet.
    if (code.startsWith('15')) return 'investing';
    return 'operating';
  };

  for (const row of rows) {
    const total = weights.get(row.entry_id) || 1;
    const share = Math.round((Number(row.movement) * Number(row.counterpart_weight)) / total);
    if (share === 0) continue;

    const activity = activityOf(row.counterpart_type, row.counterpart_code);
    const bucket = buckets[activity];
    const line = bucket.get(row.counterpart_code) ?? {
      code: row.counterpart_code,
      name: row.counterpart_name,
      amount: 0,
    };

    line.amount += share;
    bucket.set(row.counterpart_code, line);
  }

  const asSection = (bucket) => {
    const lines = [...bucket.values()]
      .filter((line) => line.amount !== 0)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((line) => ({ ...line, amount: money(line.amount) }));

    return { lines, total: money([...bucket.values()].reduce((t, l) => t + l.amount, 0)) };
  };

  const operating = asSection(buckets.operating);
  const investing = asSection(buckets.investing);
  const financing = asSection(buckets.financing);

  const net = Number(operating.total) + Number(investing.total) + Number(financing.total);
  const openingBalance = money(opening.balance);

  return {
    from,
    to,
    openingBalance,
    operating,
    investing,
    financing,
    netChange: net,
    closingBalance: openingBalance + net,
  };
};
