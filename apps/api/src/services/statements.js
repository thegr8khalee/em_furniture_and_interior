import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor } from '../lib/money.js';

/**
 * What a customer owes, as a document they can be sent.
 *
 * The receivables ageing says who owes what, which answers the owner's
 * question. It does not answer the customer's — "what is this for?" — and
 * chasing a debt with a total and no detail is how a payment gets delayed
 * another month while somebody digs out the orders.
 *
 * A statement is the account between the business and one customer over a
 * period: what was owed at the start, what happened, and what is owed now.
 */

export class StatementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'StatementError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/**
 * One customer's account over a window.
 *
 * Built from orders and receipts rather than from journal lines, because a
 * statement has to name what each figure is for and the ledger deliberately
 * carries no customer on a line. The totals agree with `1200` because the
 * condition is the same one that puts a balance there.
 */
export const customerStatement = async (
  customerId,
  { from = null, to = null } = {},
  db = getSequelize()
) => {
  if (!isValidId(String(customerId ?? ''))) throw new StatementError('Customer not found.', 404);

  const customer = await selectOne(
    db,
    'SELECT id, full_name, email, phone_number FROM customers WHERE id = :customerId',
    { customerId }
  );
  if (!customer) throw new StatementError('Customer not found.', 404);

  const end = to ?? new Date().toISOString().slice(0, 10);
  // A year back by default: long enough to explain a balance, short enough to
  // be readable.
  const start =
    from ??
    new Date(new Date(end).setFullYear(new Date(end).getFullYear() - 1))
      .toISOString()
      .slice(0, 10);

  // Everything that moved the account, both directions, in one list.
  const movements = await select(
    db,
    `WITH charges AS (
       SELECT o.created_at::date AS entry_date,
              o.order_number AS reference,
              'Order' AS kind,
              o.total_amount::bigint AS charged,
              0::bigint AS paid
         FROM orders o
        WHERE o.customer_id = :customerId
          AND o.status <> 'cancelled'
          AND EXISTS (SELECT 1 FROM journal_entries e
                       WHERE e.source = 'sales_order' AND e.source_id = o.id)
     ),
     receipts AS (
       SELECT COALESCE(t.verified_at::date, t.created_at::date) AS entry_date,
              o.order_number AS reference,
              'Payment' AS kind,
              0::bigint AS charged,
              (t.amount - t.refunded_amount)::bigint AS paid
         FROM payment_transactions t
         JOIN orders o ON o.id = t.order_id
        WHERE o.customer_id = :customerId AND t.status IN ('success', 'refunded')
     ),
     credits AS (
       SELECT r.created_at::date AS entry_date,
              o.order_number AS reference,
              'Refund' AS kind,
              0::bigint AS charged,
              r.amount::bigint AS paid
         FROM order_refunds r
         JOIN orders o ON o.id = r.order_id
        WHERE o.customer_id = :customerId
     ),
     fees AS (
       SELECT c.billed_at::date AS entry_date,
              'Design work' AS reference,
              'Design fee' AS kind,
              c.fee_total::bigint AS charged,
              CASE WHEN c.fee_paid_on IS NOT NULL THEN c.fee_total ELSE 0 END::bigint AS paid
         FROM consultation_requests c
        WHERE c.customer_id = :customerId AND c.billed_at IS NOT NULL
     ),
     everything AS (
       SELECT * FROM charges
       UNION ALL SELECT * FROM receipts
       UNION ALL SELECT * FROM credits
       UNION ALL SELECT * FROM fees
     )
     SELECT * FROM everything ORDER BY entry_date, kind`,
    { customerId }
  );

  // Anything before the window is one figure: the balance they started with.
  const opening = movements
    .filter((row) => String(row.entry_date) < start)
    .reduce((total, row) => total + Number(row.charged) - Number(row.paid), 0);

  const inWindow = movements.filter(
    (row) => String(row.entry_date) >= start && String(row.entry_date) <= end
  );

  let running = opening;
  const lines = inWindow.map((row) => {
    running += Number(row.charged) - Number(row.paid);

    return {
      date: row.entry_date,
      reference: row.reference,
      kind: row.kind,
      charged: money(row.charged),
      paid: money(row.paid),
      balance: money(running),
    };
  });

  const charged = inWindow.reduce((total, row) => total + Number(row.charged), 0);
  const paid = inWindow.reduce((total, row) => total + Number(row.paid), 0);

  return {
    customer: {
      _id: customer.id,
      name: customer.full_name,
      email: customer.email,
      phone: customer.phone_number,
    },
    from: start,
    to: end,
    openingBalance: money(opening),
    charged: money(charged),
    paid: money(paid),
    closingBalance: money(running),
    lines,
    // What they should pay, which is the only number most people read.
    amountDue: money(Math.max(running, 0)),
  };
};

/**
 * Every customer with something outstanding, for a statement run.
 *
 * Sending statements one at a time is how they stop being sent.
 */
export const statementRun = async ({ asOf = null } = {}, db = getSequelize()) => {
  const { receivablesAgeing } = await import('./books.js');
  const ageing = await receivablesAgeing({ asOf }, db);

  return {
    asOf: ageing.asOf,
    customers: ageing.customers
      .filter((row) => row.customerId)
      .map((row) => ({
        customerId: row.customerId,
        name: row.name,
        email: row.email,
        total: row.total,
        oldest: row.ninetyDaysPlus > 0 ? '90+' : row.sixtyDays > 0 ? '60' : row.thirtyDays > 0 ? '30' : 'current',
      })),
    total: ageing.totals.total,
  };
};
