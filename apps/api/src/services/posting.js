import { QueryTypes } from 'sequelize';
import { postEntry, LedgerError } from './ledger.js';
import { logger } from '../lib/logger.js';

/**
 * The posting rules — where a business event becomes a journal entry.
 *
 * Each function is idempotent: a unique index on (source, source_id) means a
 * retried webhook or a re-run job cannot post the same event twice, and the
 * duplicate is reported rather than swallowed or raised as an error. A retry
 * that succeeds the second time is a normal occurrence, not a fault.
 *
 * Every rule takes an optional transaction, because a posting should commit
 * with the thing it describes or not at all.
 */

const DUPLICATE = '23505'; // unique_violation

/** Postgres reports a duplicate source as a constraint violation; that is a no-op, not a failure. */
const postOnce = async (db, entry, options) => {
  try {
    return { ...(await postEntry(db, entry, options)), posted: true };
  } catch (error) {
    const code = error.parent?.code || error.original?.code;
    if (code === DUPLICATE && `${error.parent?.constraint}`.includes('one_per_source')) {
      logger.debug(
        { source: entry.source, sourceId: entry.sourceId },
        'Already posted; skipping duplicate'
      );
      return { posted: false, reason: 'already_posted' };
    }
    throw error;
  }
};

const one = async (db, sql, replacements, transaction) => {
  const rows = await db.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
  return rows[0] || null;
};

/**
 * An order becomes revenue when it is confirmed, not when it is paid.
 *
 * The customer owes us from that moment, so the debit is receivable rather than
 * cash; the payment posting below clears it. Recognising on payment instead
 * would leave a confirmed unpaid order invisible in every report, which is
 * exactly the gap a receivables ledger exists to close.
 *
 *   DR  1200 Accounts receivable   total
 *   DR  4900 Discounts given       discount        (contra-revenue)
 *   CR  4100 Furniture sales       subtotal
 *   CR  4300 Delivery income       shipping
 *   CR  2200 VAT payable           tax
 */
export const postOrderConfirmed = async (db, orderId, { transaction } = {}) => {
  const order = await one(
    db,
    `SELECT id, order_number, created_at::date AS entry_date, subtotal, discount,
            shipping_cost, tax_amount, total_amount
     FROM orders WHERE id = :orderId`,
    { orderId },
    transaction
  );

  if (!order) throw new LedgerError(`No order ${orderId}`);

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  const shipping = Number(order.shipping_cost);
  const tax = Number(order.tax_amount);
  const total = Number(order.total_amount);

  const lines = [{ account: '1200', debit: total, description: 'Owed by customer' }];
  if (discount > 0) lines.push({ account: '4900', debit: discount, description: 'Discount given' });
  lines.push({ account: '4100', credit: subtotal, description: 'Goods' });
  if (shipping > 0) lines.push({ account: '4300', credit: shipping, description: 'Delivery' });
  if (tax > 0) lines.push({ account: '2200', credit: tax, description: 'VAT collected' });

  return postOnce(
    db,
    {
      date: order.entry_date,
      description: `Order ${order.order_number} confirmed`,
      source: 'sales_order',
      sourceId: order.id,
      lines,
    },
    { transaction }
  );
};

// Where the money actually landed. Cash on delivery reaches the cash box, not
// the Paystack settlement account.
const SETTLEMENT_ACCOUNT = {
  paystack: '1110',
  bank_transfer: '1120',
  cash_on_delivery: '1130',
  whatsapp: '1120',
  download_invoice: '1120',
};

/**
 * A payment clears the receivable. It does not create revenue — that already
 * happened when the order was confirmed.
 *
 *   DR  bank/cash   amount
 *   CR  1200 Accounts receivable   amount
 */
export const postPaymentReceived = async (db, transactionId, { transaction } = {}) => {
  const payment = await one(
    db,
    `SELECT t.id, t.amount, t.payment_method, t.status,
            COALESCE(t.verified_at::date, t.created_at::date) AS entry_date,
            o.order_number
     FROM payment_transactions t
     JOIN orders o ON o.id = t.order_id
     WHERE t.id = :transactionId`,
    { transactionId },
    transaction
  );

  if (!payment) throw new LedgerError(`No payment transaction ${transactionId}`);
  if (payment.status !== 'success') {
    // A pending or failed charge has moved no money. Posting it would put cash
    // on the balance sheet that does not exist.
    return { posted: false, reason: `status_is_${payment.status}` };
  }

  const account = SETTLEMENT_ACCOUNT[payment.payment_method];
  if (!account) throw new LedgerError(`No settlement account for ${payment.payment_method}`);

  const amount = Number(payment.amount);

  return postOnce(
    db,
    {
      date: payment.entry_date,
      description: `Payment received for ${payment.order_number}`,
      source: 'payment',
      sourceId: payment.id,
      lines: [
        { account, debit: amount, description: `Received via ${payment.payment_method}` },
        { account: '1200', credit: amount, description: 'Receivable cleared' },
      ],
    },
    { transaction }
  );
};

/**
 * An approved expense is a cost and a debt, in the same moment.
 *
 *   DR  the expense account   net
 *   DR  2200 VAT payable      tax        (input VAT, reclaimable)
 *   CR  2100 Accounts payable total
 *
 * On the accrual basis a cost belongs to the period it was incurred in, not the
 * period it was paid in — which is the whole reason approval and payment are two
 * events here rather than one.
 *
 * Input VAT debits the same account output VAT credits, so `2200` nets to what
 * is actually owed to the revenue service. That is what a VAT account is.
 */
export const postExpenseApproved = async (db, expenseId, { transaction } = {}) => {
  const expense = await one(
    db,
    `SELECT e.id, e.expense_number, e.description, e.expense_date,
            e.net_amount, e.tax_amount, e.total_amount, e.status,
            a.code AS account_code, v.name AS vendor_name
     FROM expenses e
     JOIN accounts a ON a.id = e.account_id
     LEFT JOIN vendors v ON v.id = e.vendor_id
     WHERE e.id = :expenseId`,
    { expenseId },
    transaction
  );

  if (!expense) throw new LedgerError(`No expense ${expenseId}`);
  if (expense.status === 'draft' || expense.status === 'void') {
    // A draft is a note to self. It becomes a liability when somebody approves
    // it, and not before.
    return { posted: false, reason: `status_is_${expense.status}` };
  }

  const net = Number(expense.net_amount);
  const tax = Number(expense.tax_amount);
  const total = Number(expense.total_amount);

  const lines = [{ account: expense.account_code, debit: net, description: expense.description }];
  if (tax > 0) lines.push({ account: '2200', debit: tax, description: 'Input VAT' });
  lines.push({ account: '2100', credit: total, description: expense.vendor_name ?? 'Supplier' });

  return postOnce(
    db,
    {
      date: expense.expense_date,
      description: `${expense.expense_number}: ${expense.description}`,
      source: 'expense',
      sourceId: expense.id,
      lines,
    },
    { transaction }
  );
};

/**
 * Paying a supplier clears the debt. It is not a cost — that was recognised
 * when the expense was approved.
 *
 *   DR  2100 Accounts payable  total
 *   CR  bank/cash              total
 */
export const postExpensePaid = async (db, expenseId, { transaction } = {}) => {
  const expense = await one(
    db,
    `SELECT e.id, e.expense_number, e.total_amount, e.status, e.payment_method,
            COALESCE(e.paid_on, e.expense_date) AS entry_date,
            v.name AS vendor_name
     FROM expenses e
     LEFT JOIN vendors v ON v.id = e.vendor_id
     WHERE e.id = :expenseId`,
    { expenseId },
    transaction
  );

  if (!expense) throw new LedgerError(`No expense ${expenseId}`);
  if (expense.status !== 'paid') return { posted: false, reason: `status_is_${expense.status}` };

  const account = SETTLEMENT_ACCOUNT[expense.payment_method];
  if (!account) throw new LedgerError(`No settlement account for ${expense.payment_method}`);

  const total = Number(expense.total_amount);

  return postOnce(
    db,
    {
      date: expense.entry_date,
      description: `Paid ${expense.expense_number}${expense.vendor_name ? ` to ${expense.vendor_name}` : ''}`,
      source: 'expense_payment',
      sourceId: expense.id,
      lines: [
        { account: '2100', debit: total, description: 'Payable settled' },
        { account, credit: total, description: `Paid by ${expense.payment_method}` },
      ],
    },
    { transaction }
  );
};

/**
 * Paying a supplier for goods already received.
 *
 * The mirror of `postExpensePaid`, for the other kind of payable. Receiving a
 * purchase order raises the debt; this settles it.
 *
 *   DR  2100 Accounts payable   total
 *   CR  bank or cash            total
 */
export const postPurchaseOrderPaid = async (db, orderId, { transaction } = {}) => {
  const order = await one(
    db,
    `SELECT po.id, po.po_number, po.status, po.payment_method,
            COALESCE(po.paid_on, po.received_on) AS entry_date,
            v.name AS vendor_name,
            COALESCE((SELECT SUM(i.line_total) FROM purchase_order_items i
                       WHERE i.purchase_order_id = po.id), 0) AS total
     FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     WHERE po.id = :orderId`,
    { orderId },
    transaction
  );

  if (!order) throw new LedgerError(`No purchase order ${orderId}`);
  if (order.status !== 'received') {
    return { posted: false, reason: `status_is_${order.status}` };
  }

  const total = Number(order.total);
  if (total === 0) return { posted: false, reason: 'zero_value' };

  const account = SETTLEMENT_ACCOUNT[order.payment_method];
  if (!account) throw new LedgerError(`No settlement account for ${order.payment_method}`);

  return postOnce(
    db,
    {
      date: order.entry_date,
      description: `Paid ${order.po_number} to ${order.vendor_name}`,
      source: 'purchase',
      sourceId: order.id,
      lines: [
        { account: '2100', debit: total, description: 'Payable settled' },
        { account, credit: total, description: `Paid by ${order.payment_method}` },
      ],
    },
    { transaction }
  );
};

// What each kind of stock movement does to the books. Inventory (1300) is the
// other side of every one of them.
const STOCK_RULES = {
  purchase_receipt: { counterpart: '2100', inventoryIncreases: true },  // owed to supplier
  return:           { counterpart: '5100', inventoryIncreases: true },  // reverses cost of sale
  transfer_in:      null,                                              // no value change
  sale:             { counterpart: '5100', inventoryIncreases: false }, // cost of goods sold
  damage:           { counterpart: '5400', inventoryIncreases: false }, // written off
  transfer_out:     null,
  adjustment:       { counterpart: '5400', inventoryIncreases: null },  // direction follows sign
};

/**
 * Stock moving is a change in the value of what the business owns, so it posts.
 *
 * The amount needs a unit cost. The movement carries one where it is known —
 * a purchase receipt knows what was paid — and otherwise it falls back to the
 * product's cost price. If neither exists the posting is SKIPPED with a reason
 * rather than guessed at: a cost of goods sold figure invented from nothing is
 * worse than an absent one, because it looks like a real margin.
 */
export const postStockMovement = async (db, movementId, { transaction } = {}) => {
  const movement = await one(
    db,
    `SELECT m.id, m.quantity, m.reason, m.occurred_at::date AS entry_date,
            COALESCE(m.unit_cost, s.cost_price) AS unit_cost,
            s.name AS product_name
     FROM stock_movements m
     JOIN sellable_items s ON s.id = m.product_id
     WHERE m.id = :movementId`,
    { movementId },
    transaction
  );

  if (!movement) throw new LedgerError(`No stock movement ${movementId}`);

  const rule = STOCK_RULES[movement.reason];
  if (!rule) {
    // A transfer between locations changes where stock is, not what it is worth.
    return { posted: false, reason: 'no_value_change' };
  }

  if (movement.unit_cost === null || movement.unit_cost === undefined) {
    logger.warn(
      { movementId, reason: movement.reason, product: movement.product_name },
      'Stock movement not posted: no unit cost on the movement or the product'
    );
    return { posted: false, reason: 'unknown_cost' };
  }

  const quantity = Number(movement.quantity);
  const value = Math.abs(quantity) * Number(movement.unit_cost);
  if (value === 0) return { posted: false, reason: 'zero_value' };

  const increasing = rule.inventoryIncreases ?? quantity > 0;

  const lines = increasing
    ? [
        { account: '1300', debit: value, description: 'Inventory in' },
        { account: rule.counterpart, credit: value },
      ]
    : [
        { account: rule.counterpart, debit: value },
        { account: '1300', credit: value, description: 'Inventory out' },
      ];

  return postOnce(
    db,
    {
      date: movement.entry_date,
      description: `Stock ${movement.reason.replace(/_/g, ' ')}: ${movement.product_name}`,
      source: 'stock_movement',
      sourceId: movement.id,
      lines,
    },
    { transaction }
  );
};
