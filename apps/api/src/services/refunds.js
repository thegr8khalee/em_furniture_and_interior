import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';
import { postRefund, postStockMovement } from './posting.js';

/**
 * Giving money back.
 *
 * Both status enums have carried `refunded` since the first commerce migration,
 * the console offers it on two dropdowns, and nothing behind it did anything: a
 * refund moved a word on a screen. Revenue stayed recognised, the cash stayed in
 * the bank, VAT stayed owed on a reversed sale, and returned goods never came
 * back into stock.
 *
 * A refund here does four things in one transaction, or none of them:
 *
 *   1. records what was given back, why, and by whom;
 *   2. writes it against the receipt it reverses, so `refunded_amount` can never
 *      exceed what was actually taken;
 *   3. posts it — revenue, delivery and VAT out, cash out;
 *   4. brings the goods back into stock, if they came back.
 */

export class RefundError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RefundError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

const publicRefund = (row) => ({
  _id: row.id,
  orderId: row.order_id,
  orderNumber: row.order_number,
  amount: money(row.amount),
  reason: row.reason,
  restocked: row.restocked,
  refundedOn: row.refunded_on,
  refundedBy: row.refunded_by,
  createdAt: row.created_at,
});

const REFUND_SELECT = `
  SELECT r.id, r.order_id, r.amount, r.reason, r.restocked, r.refunded_on,
         r.refunded_by, r.created_at, o.order_number
    FROM order_refunds r
    JOIN orders o ON o.id = r.order_id
`;

/**
 * What is left to give back on an order.
 *
 * Taken from the receipts rather than from the order total: a refund can only
 * return money that actually arrived, so an order marked paid by hand with no
 * transaction behind it has nothing to refund and says so.
 */
export const refundableAmount = async (orderId, db = getSequelize(), opts = {}) => {
  const row = await selectOne(
    db,
    `SELECT COALESCE(SUM(t.amount - t.refunded_amount), 0)::bigint AS refundable,
            COALESCE(SUM(t.amount), 0)::bigint AS received
       FROM payment_transactions t
      WHERE t.order_id = :orderId AND t.status IN ('success', 'refunded')`,
    { orderId },
    opts
  );

  return { refundable: Number(row.refundable), received: Number(row.received) };
};

/** Every refund against an order, newest first. */
export const listRefunds = async (orderId, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) throw new RefundError('Order not found.', 404);

  const rows = await select(db, `${REFUND_SELECT} WHERE r.order_id = :orderId
                                  ORDER BY r.created_at DESC`, { orderId });

  const { refundable, received } = await refundableAmount(orderId, db);

  return {
    refunds: rows.map(publicRefund),
    refunded: money(received - refundable),
    refundable: money(refundable),
  };
};

/**
 * Gives money back.
 *
 * `amount` is optional and defaults to everything still refundable, because the
 * common case is the whole order and making an operator retype the figure is how
 * the wrong figure gets typed.
 *
 * Restocking is only offered on a full refund. Choosing which lines came back
 * out of a partial one is a guess, and a guess about stock is how a count stops
 * being explainable — the operator can record the return by hand instead.
 */
export const refundOrder = async (
  orderId,
  { amount = null, reason, restock = false, staffId = null, refundedOn = null } = {},
  db = getSequelize()
) => {
  if (!isValidId(String(orderId ?? ''))) throw new RefundError('Order not found.', 404);

  if (!reason || !String(reason).trim()) {
    throw new RefundError(
      'A refund needs a reason. It is the first thing anyone asks about it later.'
    );
  }

  const id = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const order = await selectOne(
      db,
      `SELECT id, order_number, status, payment_status, total_amount
         FROM orders WHERE id = :orderId FOR UPDATE`,
      { orderId },
      opts
    );
    if (!order) throw new RefundError('Order not found.', 404);

    const { refundable } = await refundableAmount(orderId, db, opts);

    if (refundable <= 0) {
      throw new RefundError(
        order.payment_status === 'paid'
          ? 'Nothing to refund: no payment was recorded against this order.'
          : 'Nothing to refund: this order was never paid.'
      );
    }

    const requested = amount === null || amount === undefined ? refundable : toMinor(Number(amount));

    if (!Number.isFinite(requested) || requested <= 0) {
      throw new RefundError('A refund has to be a positive amount.');
    }
    if (requested > refundable) {
      throw new RefundError(
        `That is more than is left to refund — ${money(refundable)} remains.`
      );
    }

    const isFull = requested === refundable;

    if (restock && !isFull) {
      throw new RefundError(
        'Stock can only be returned on a full refund. Record the return by hand for a partial one.'
      );
    }

    // Spend the refund against the receipts, oldest first, so `refunded_amount`
    // can never exceed what a transaction actually took.
    const receipts = await select(
      db,
      `SELECT id, amount, refunded_amount FROM payment_transactions
        WHERE order_id = :orderId AND status IN ('success', 'refunded')
        ORDER BY created_at
        FOR UPDATE`,
      { orderId },
      opts
    );

    let outstanding = requested;
    let firstTransaction = null;

    for (const receipt of receipts) {
      if (outstanding === 0) break;

      const available = Number(receipt.amount) - Number(receipt.refunded_amount);
      if (available <= 0) continue;

      const taken = Math.min(available, outstanding);
      outstanding -= taken;
      firstTransaction = firstTransaction ?? receipt.id;

      await db.query(
        `UPDATE payment_transactions
            SET refunded_amount = refunded_amount + :taken,
                refunded_at = now(),
                status = CASE WHEN refunded_amount + :taken >= amount
                              THEN 'refunded'::transaction_status ELSE status END
          WHERE id = :id`,
        { replacements: { id: receipt.id, taken }, ...opts }
      );
    }

    const refund = await selectOne(
      db,
      `INSERT INTO order_refunds
         (order_id, transaction_id, amount, reason, restocked, refunded_on, refunded_by)
       VALUES (:orderId, :transactionId, :amount, :reason, :restocked,
               COALESCE(:refundedOn::date, CURRENT_DATE), :staffId)
       RETURNING id`,
      {
        orderId,
        transactionId: firstTransaction,
        amount: requested,
        reason: String(reason).trim(),
        restocked: Boolean(restock),
        refundedOn: refundedOn || null,
        staffId: isValidId(String(staffId ?? '')) ? staffId : null,
      },
      opts
    );

    // A fully refunded order is refunded; a partly refunded one is still the
    // order it was, with money owed back against it.
    if (isFull) {
      await db.query(
        `UPDATE orders SET status = 'refunded', payment_status = 'refunded' WHERE id = :orderId`,
        { replacements: { orderId }, ...opts }
      );
    }

    await postRefund(db, refund.id, opts);

    if (restock) {
      // `return` movements are positive and name their order, which the schema
      // insists on. They post inventory back in against cost of sales, which is
      // the reverse of what the sale did.
      const movements = await select(
        db,
        `INSERT INTO stock_movements (product_id, quantity, reason, order_id, staff_id, unit_cost)
         SELECT p.id, oi.quantity, 'return', oi.order_id, :staffId, oi.unit_cost
           FROM order_items oi
           JOIN products p ON p.id = oi.sellable_item_id
          WHERE oi.order_id = :orderId
         RETURNING id`,
        { orderId, staffId: isValidId(String(staffId ?? '')) ? staffId : null },
        opts
      );

      for (const movement of movements) {
        await postStockMovement(db, movement.id, opts);
      }
    }

    return refund.id;
  });

  const row = await selectOne(db, `${REFUND_SELECT} WHERE r.id = :id`, { id });
  return publicRefund(row);
};
