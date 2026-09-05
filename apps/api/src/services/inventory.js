import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { postStockMovement } from './posting.js';

/**
 * Stock, against PostgreSQL.
 *
 * There is no quantity to set. `stock_movements` is the ledger and every
 * balance is derived from it — `product_stock` is a cache the database
 * maintains, and `product_stock_discrepancies` exists to catch anyone who
 * writes to it directly. The Mongo version assigned `product.stockQuantity` and
 * wrote a parallel `InventoryAdjustment` document describing what it had just
 * done, which meant the count and the explanation could disagree, and usually
 * would after any correction applied by hand.
 *
 * So "set the quantity to 12" becomes "record the movement that takes it to
 * 12". The arithmetic is the same; what changes is that the reason survives,
 * and that the number can always be re-derived.
 *
 * `stock_adjustment_needs_a_note` refuses an adjustment with no explanation. A
 * correction nobody explained is how a discrepancy becomes permanent.
 */

export class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const publicStock = (row) => ({
  _id: row.product_id,
  name: row.name,
  sku: row.sku,
  stockQuantity: row.available,
  onHand: row.on_hand,
  reserved: row.reserved,
  lowStockThreshold: row.low_stock_threshold,
  warehouseLocation: row.warehouse_location,
  isLowStock: row.is_low,
  updatedAt: row.updated_at,
});

/**
 * What is in the warehouse, and what is sellable.
 *
 * `stockQuantity` publishes the *available* figure — on hand less what is held
 * for confirmed orders — because that is the number an operator is deciding
 * from. `onHand` and `reserved` are published beside it so the difference is
 * visible rather than surprising.
 */
export const listStock = async (
  { page = 1, limit = 20, search = null, lowStock = false } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (search) {
    where.push('(s.name ILIKE :search OR p.sku ILIKE :search)');
    replacements.search = `%${search}%`;
  }
  if (lowStock) where.push('av.is_low');

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `SELECT av.product_id, s.name, p.sku, av.on_hand, av.reserved, av.available,
            av.low_stock_threshold, p.warehouse_location, s.updated_at
       FROM product_availability av
       JOIN products p ON p.id = av.product_id
       JOIN sellable_items s ON s.id = p.id
       ${filter}
      ORDER BY s.updated_at DESC
      LIMIT :limit OFFSET :offset`,
    replacements
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total
       FROM product_availability av
       JOIN products p ON p.id = av.product_id
       JOIN sellable_items s ON s.id = p.id
       ${filter}`,
    replacements
  );

  return { products: rows.map(publicStock), total: counted.total };
};

/**
 * Corrects a count by recording the movement that explains it.
 *
 * Takes either a delta or an absolute figure, as the old endpoint did, and
 * turns an absolute figure into the movement that would produce it. A count
 * that is already right writes nothing rather than a zero-quantity row, which
 * the schema refuses anyway — zero is not a movement, it is a row somebody
 * forgot to fill in.
 */
export const adjustStock = async (
  productId,
  { delta, newQuantity, reason },
  staffId = null,
  db = getSequelize()
) => {
  if (!isValidId(String(productId ?? ''))) throw new InventoryError('Product not found.', 404);

  if (delta === undefined && newQuantity === undefined) {
    throw new InventoryError('Provide delta or newQuantity.');
  }

  if (!reason || !String(reason).trim()) {
    throw new InventoryError('A reason is required for a stock adjustment.');
  }

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const current = await selectOne(
      db,
      `SELECT av.product_id, s.name, p.sku, av.on_hand, av.reserved, av.available,
              av.low_stock_threshold, p.warehouse_location, s.updated_at
         FROM product_availability av
         JOIN products p ON p.id = av.product_id
         JOIN sellable_items s ON s.id = p.id
        WHERE av.product_id = :productId`,
      { productId },
      opts
    );

    if (!current) throw new InventoryError('Product not found.', 404);

    let movement;
    if (newQuantity !== undefined) {
      const target = Number.parseInt(newQuantity, 10);
      if (!Number.isInteger(target) || target < 0) {
        throw new InventoryError('New quantity must be a non-negative number.');
      }
      movement = target - current.on_hand;
    } else {
      movement = Number.parseInt(delta, 10);
      if (!Number.isInteger(movement)) {
        throw new InventoryError('Delta must be a number.');
      }
      // A correction may not drive the count below zero.
      if (current.on_hand + movement < 0) movement = -current.on_hand;
    }

    if (movement !== 0) {
      const recorded = await selectOne(
        db,
        `INSERT INTO stock_movements (product_id, quantity, reason, staff_id, note)
         VALUES (:productId, :quantity, 'adjustment', :staffId, :note)
         RETURNING id`,
        { productId, quantity: movement, staffId, note: String(reason).trim() },
        opts
      );

      // A correction changes what the business owns, so it posts — written off
      // against 5400 when stock goes down, and back into inventory when a count
      // finds more than the books said.
      await postStockMovement(db, recorded.id, opts);
    }

    const updated = await selectOne(
      db,
      `SELECT av.product_id, s.name, p.sku, av.on_hand, av.reserved, av.available,
              av.low_stock_threshold, p.warehouse_location, s.updated_at
         FROM product_availability av
         JOIN products p ON p.id = av.product_id
         JOIN sellable_items s ON s.id = p.id
        WHERE av.product_id = :productId`,
      { productId },
      opts
    );

    return { product: publicStock(updated), movement };
  });
};

/**
 * The movements behind one product's count.
 *
 * This is what the old `InventoryAdjustment` collection was for, except it is
 * the same rows the balance is computed from rather than a description of them
 * written separately.
 */
export const movementsFor = async (productId, { limit = 50 } = {}, db = getSequelize()) => {
  if (!isValidId(String(productId ?? ''))) throw new InventoryError('Product not found.', 404);

  const rows = await select(
    db,
    `SELECT m.id, m.quantity, m.reason, m.note, m.order_id, m.occurred_at,
            st.username AS staff_username
       FROM stock_movements m
       LEFT JOIN staff st ON st.id = m.staff_id
      WHERE m.product_id = :productId
      ORDER BY m.occurred_at DESC, m.id DESC
      LIMIT :limit`,
    { productId, limit }
  );

  return rows.map((row) => ({
    _id: row.id,
    delta: row.quantity,
    reason: row.reason,
    note: row.note,
    orderId: row.order_id,
    adjustedBy: row.staff_username,
    createdAt: row.occurred_at,
  }));
};
