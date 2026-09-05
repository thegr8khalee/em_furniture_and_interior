import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';

/**
 * Reviews, against PostgreSQL.
 *
 * One table for both kinds of item. Mongo embedded an identical review schema
 * twice — once in the product document, once in the collection — so "everything
 * awaiting moderation" meant scanning two collections and merging the results in
 * application code, and there were two copies of every handler, one per subtype.
 * Here the eight endpoints are four, and the subtype is a column on the item.
 *
 * Two things the database now guarantees:
 *
 *   - **One review per customer per item**, by unique index. The embedded array
 *     allowed duplicates; the handler checked first, which is a race.
 *   - **The rating**, maintained by `reviews_refresh_rating`. It was a Mongoose
 *     `pre('save')` hook, so approving a review through anything but that one
 *     path left the average stale. Only approved reviews count, so posting a
 *     review cannot move the number on its own.
 *
 * The published shape keeps the old field names — `isApproved`,
 * `isVerifiedPurchase`, `userId` — because the console reads them. Reading the
 * approved reviews on an item is not here: `services/catalog.js` already
 * publishes them with the item, and two ways to ask the same question is how
 * the two answers start to differ.
 */

export class ReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ReviewError';
    this.status = status;
  }
}

/** The statuses at which an order counts as a purchase, not merely an intention. */
const PURCHASED = ['confirmed', 'processing', 'shipped', 'delivered'];

const KIND = { Product: 'product', Collection: 'collection' };

const publicReview = (row) => ({
  _id: row.id,
  userId: row.customer_id
    ? { _id: row.customer_id, username: row.customer_name ?? undefined }
    : null,
  rating: row.rating,
  comment: row.comment ?? '',
  isVerifiedPurchase: row.is_verified_purchase,
  isApproved: row.is_approved,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMNS = `r.id, r.sellable_item_id, r.customer_id, r.rating, r.comment,
                 r.is_verified_purchase, r.is_approved, r.approved_by, r.approved_at,
                 r.created_at, r.updated_at`;

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/**
 * Whether this customer has actually bought this item.
 *
 * An order line references `sellable_items`, so one query answers it for both
 * products and collections. A cancelled or refunded order does not count, and
 * neither does a pending one — an unpaid order anybody can create would
 * otherwise be a way to review anything.
 */
const hasPurchased = async (db, customerId, itemId) => {
  const row = await selectOne(
    db,
    `SELECT 1 AS found
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.customer_id = :customerId
        AND oi.sellable_item_id = :itemId
        AND o.status IN (:statuses)
      LIMIT 1`,
    { customerId, itemId, statuses: PURCHASED }
  );
  return Boolean(row);
};

/**
 * Records a review, pending moderation.
 *
 * `is_verified_purchase` is not taken from the caller — it is the result of the
 * purchase check that gates the endpoint, which is the only thing that makes the
 * badge mean anything.
 */
export const addReview = async (
  { itemId, itemType, customerId, rating, comment },
  db = getSequelize()
) => {
  const kind = KIND[itemType];
  if (!kind) throw new ReviewError(`"${itemType}" is not a kind of item.`);
  if (!isValidId(String(itemId ?? ''))) {
    throw new ReviewError(`Invalid ${itemType} ID format.`);
  }

  const numeric = Number(rating);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
    throw new ReviewError('Rating is required and must be between 1 and 5.');
  }

  const item = await selectOne(
    db,
    'SELECT id, kind, average_rating FROM sellable_items WHERE id = :itemId AND kind = :kind::sellable_kind',
    { itemId, kind }
  );
  if (!item) throw new ReviewError(`${itemType} not found.`, 404);

  if (!(await hasPurchased(db, customerId, itemId))) {
    throw new ReviewError(
      `Only verified purchasers can review this ${itemType.toLowerCase()}.`,
      403
    );
  }

  const row = await selectOne(
    db,
    `INSERT INTO reviews (sellable_item_id, customer_id, rating, comment, is_verified_purchase)
     VALUES (:itemId, :customerId, :rating, :comment, true)
     ON CONFLICT (sellable_item_id, customer_id) DO NOTHING
     RETURNING ${COLUMNS.replaceAll('r.', '')}`,
    { itemId, customerId, rating: numeric, comment: comment || null }
  );

  if (!row) {
    throw new ReviewError(`${itemType} already reviewed by this user.`);
  }

  const rated = await selectOne(
    db,
    'SELECT average_rating FROM sellable_items WHERE id = :itemId',
    { itemId }
  );

  return {
    review: publicReview(row),
    // Unchanged by an unapproved review, and that is the point: the number
    // cannot be moved by anyone who can post.
    averageRating: Number(rated.average_rating),
  };
};

/**
 * Everything awaiting moderation, for one kind of item.
 *
 * One query with a join, where Mongo needed every product document with an
 * unapproved review loaded in full and flattened in JavaScript.
 */
export const pendingReviews = async (itemType, { page = 1, limit = 50 } = {}, db = getSequelize()) => {
  const kind = KIND[itemType];
  if (!kind) throw new ReviewError(`"${itemType}" is not a kind of item.`);

  const rows = await select(
    db,
    `SELECT ${COLUMNS}, s.id AS parent_id, s.name AS parent_name, c.full_name AS customer_name
       FROM reviews r
       JOIN sellable_items s ON s.id = r.sellable_item_id
       LEFT JOIN customers c ON c.id = r.customer_id
      WHERE NOT r.is_approved AND s.kind = :kind::sellable_kind
      ORDER BY r.created_at
      LIMIT :limit OFFSET :offset`,
    { kind, limit, offset: (page - 1) * limit }
  );

  return rows.map((row) => ({
    type: itemType,
    parentId: row.parent_id,
    parentName: row.parent_name,
    review: publicReview(row),
  }));
};

/**
 * Approves a review.
 *
 * `approved_at` is set in the same statement, because
 * `reviews_approval_is_attributed` requires an approved review to say when — an
 * approval with no timestamp is refused rather than stored.
 */
export const approveReview = async (reviewId, staffId = null, db = getSequelize()) => {
  if (!isValidId(String(reviewId ?? ''))) throw new ReviewError('Review not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE reviews SET is_approved = true, approved_at = now(), approved_by = :staffId
      WHERE id = :reviewId
      RETURNING ${COLUMNS.replaceAll('r.', '')}`,
    { reviewId, staffId }
  );

  if (!row) throw new ReviewError('Review not found.', 404);
  return publicReview(row);
};

/** Rejecting a review deletes it; the rating follows, by trigger. */
export const rejectReview = async (reviewId, db = getSequelize()) => {
  if (!isValidId(String(reviewId ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM reviews WHERE id = :reviewId', {
    replacements: { reviewId },
  });
  return (result?.rowCount ?? 0) > 0;
};
