import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor, percentOf } from '../lib/money.js';

/**
 * Coupons, against PostgreSQL.
 *
 * Two units live in `discount_value`, which is why the column is a plain bigint
 * and not `money_minor`: basis points for a percentage (500 = 5%), kobo for a
 * fixed amount. `discount_type` says which, and `coupons_percentage_within_range`
 * stops a percentage above 100 — a 150% discount is a data-entry error, not a
 * promotion. The API keeps publishing percentages as percentages and money as
 * naira, so the conversion happens here and nowhere else.
 *
 * The usage limit is enforced by the database twice over: as a check constraint
 * on the row, and by the conditional UPDATE in `claim` below, which is one
 * statement rather than the read-decide-increment that let a single-use code be
 * spent by several simultaneous checkouts.
 *
 * Product, collection and category targeting is not carried over. The Mongo
 * model had five array fields for it, the console never set any of them — it
 * sends empty arrays on every create — and nothing else read them. Adding it
 * back is a join table when somebody actually wants it.
 */

export class CouponError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CouponError';
    this.status = status;
  }
}

const COLUMNS = `id, code, description, discount_type, discount_value, max_discount,
                 min_purchase, usage_limit, times_used, starts_at, expires_at,
                 is_active, created_at, updated_at`;

export const publicCoupon = (row) => ({
  _id: row.id,
  id: row.id,
  code: row.code,
  description: row.description,
  discountType: row.discount_type,
  // A percentage comes back as a percentage; a fixed amount comes back in naira.
  discountValue:
    row.discount_type === 'percentage'
      ? Number(row.discount_value) / 100
      : toMajor(Number(row.discount_value)),
  minimumPurchase: toMajor(Number(row.min_purchase)),
  maximumDiscount: row.max_discount === null ? null : toMajor(Number(row.max_discount)),
  validFrom: row.starts_at,
  validUntil: row.expires_at,
  usageLimit: row.usage_limit,
  usageCount: row.times_used,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * What a coupon takes off a subtotal, in kobo.
 *
 * The one definition, used both when quoting a discount to the shopper and when
 * spending the code at checkout. Two copies of this arithmetic is how a cart
 * ends up quoting one figure and charging another.
 */
export const discountFor = (coupon, subtotalMinor) => {
  const raw =
    coupon.discount_type === 'percentage'
      ? percentOf(subtotalMinor, Number(coupon.discount_value) / 100)
      : Number(coupon.discount_value);

  const capped = coupon.max_discount === null ? raw : Math.min(raw, Number(coupon.max_discount));

  // Never more than the goods: `orders_discount_within_subtotal` would refuse
  // the order, and a promotion that pays the customer is not what was meant.
  return Math.min(capped, subtotalMinor);
};

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/**
 * Quotes a coupon without spending it.
 *
 * Each refusal says which rule it failed, because "invalid coupon" for an
 * expired code, a code below its minimum, and a code that does not exist sends
 * the shopper to support for three different reasons.
 */
export const quote = async (code, subtotalMinor, db = getSequelize()) => {
  if (!code) throw new CouponError('Coupon code is required.');

  const coupon = await selectOne(db, `SELECT ${COLUMNS} FROM coupons WHERE upper(code) = :code`, {
    code: String(code).toUpperCase(),
  });

  if (!coupon) throw new CouponError('Invalid coupon code.', 404);
  if (!coupon.is_active) throw new CouponError('This coupon is no longer active.');

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    throw new CouponError('This coupon is not valid yet.');
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    throw new CouponError('This coupon has expired.');
  }
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
    throw new CouponError('This coupon has been fully redeemed.');
  }
  if (Number(coupon.min_purchase) > subtotalMinor) {
    throw new CouponError(
      `This coupon needs a subtotal of at least ₦${toMajor(Number(coupon.min_purchase)).toLocaleString('en-NG')}.`
    );
  }

  return { coupon: publicCoupon(coupon), discount: discountFor(coupon, subtotalMinor) };
};

/**
 * Spends one use of a coupon, atomically.
 *
 * Every condition that makes a coupon usable is in the WHERE clause, so the
 * check and the increment cannot be separated by another checkout. No row back
 * means the code did not apply — the caller decides whether that is an error or
 * simply full price.
 */
export const claim = async (code, subtotalMinor, db = getSequelize(), opts = {}) => {
  if (!code) return null;

  const coupon = await selectOne(
    db,
    `UPDATE coupons SET times_used = times_used + 1
      WHERE upper(code) = :code
        AND is_active
        AND (starts_at IS NULL OR starts_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
        AND (usage_limit IS NULL OR times_used < usage_limit)
        AND min_purchase <= :subtotal
      RETURNING ${COLUMNS}`,
    { code: String(code).toUpperCase(), subtotal: subtotalMinor },
    opts
  );

  if (!coupon) return null;

  return { coupon, discount: discountFor(coupon, subtotalMinor) };
};

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

/** Naira and percentages in, the column's own unit out. */
const toStoredValue = (discountType, discountValue) => {
  const value = Number(discountValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new CouponError('Discount value must be a positive number.');
  }

  if (discountType === 'percentage') {
    if (value > 100) throw new CouponError('A percentage discount cannot exceed 100%.');
    return Math.round(value * 100); // basis points
  }
  if (discountType === 'fixed') return toMinor(value);

  throw new CouponError(`"${discountType}" is not a discount type.`);
};

export const createCoupon = async (input, db = getSequelize()) => {
  const { code, discountType, discountValue, validUntil } = input || {};

  if (!code || !discountType || discountValue === undefined || !validUntil) {
    throw new CouponError(
      'Code, discount type, discount value, and valid until are required.'
    );
  }

  const row = await selectOne(
    db,
    `INSERT INTO coupons (code, description, discount_type, discount_value, max_discount,
                          min_purchase, usage_limit, starts_at, expires_at, is_active)
     VALUES (:code, :description, :discountType::discount_type, :discountValue, :maxDiscount,
             :minPurchase, :usageLimit, :startsAt, :expiresAt, :isActive)
     ON CONFLICT (code) DO NOTHING
     RETURNING ${COLUMNS}`,
    {
      code: String(code).toUpperCase(),
      description: input.description || null,
      discountType,
      discountValue: toStoredValue(discountType, discountValue),
      maxDiscount:
        input.maximumDiscount === undefined || input.maximumDiscount === null
          ? null
          : toMinor(Number(input.maximumDiscount)),
      minPurchase: toMinor(Number(input.minimumPurchase) || 0),
      usageLimit: input.usageLimit ?? null,
      startsAt: input.validFrom ?? null,
      expiresAt: validUntil,
      isActive: input.isActive ?? true,
    }
  ).catch((error) => {
    if (error?.original?.code === '22P02') {
      throw new CouponError(`"${discountType}" is not a discount type.`);
    }
    throw error;
  });

  if (!row) throw new CouponError('Coupon code already exists.');
  return publicCoupon(row);
};

export const updateCoupon = async (couponId, input, db = getSequelize()) => {
  if (!isValidId(String(couponId ?? ''))) throw new CouponError('Coupon not found.', 404);

  const existing = await selectOne(db, `SELECT ${COLUMNS} FROM coupons WHERE id = :id`, {
    id: couponId,
  });
  if (!existing) throw new CouponError('Coupon not found.', 404);

  // The stored value depends on the type, so changing one without the other
  // would silently reinterpret the number already in the column.
  const discountType = input.discountType ?? existing.discount_type;
  const discountValue =
    input.discountValue === undefined
      ? existing.discount_type === discountType
        ? Number(existing.discount_value)
        : (() => {
            throw new CouponError(
              'Changing the discount type needs a new discount value as well.'
            );
          })()
      : toStoredValue(discountType, input.discountValue);

  const row = await selectOne(
    db,
    `UPDATE coupons SET
       code = COALESCE(:code, code),
       description = COALESCE(:description, description),
       discount_type = :discountType::discount_type,
       discount_value = :discountValue,
       max_discount = CASE WHEN :maxDiscountGiven THEN :maxDiscount ELSE max_discount END,
       min_purchase = COALESCE(:minPurchase, min_purchase),
       usage_limit = CASE WHEN :usageLimitGiven THEN :usageLimit ELSE usage_limit END,
       starts_at = COALESCE(:startsAt, starts_at),
       expires_at = COALESCE(:expiresAt, expires_at),
       is_active = COALESCE(:isActive, is_active)
     WHERE id = :id
     RETURNING ${COLUMNS}`,
    {
      id: couponId,
      code: input.code ? String(input.code).toUpperCase() : null,
      description: input.description ?? null,
      discountType,
      discountValue,
      maxDiscountGiven: input.maximumDiscount !== undefined,
      maxDiscount:
        input.maximumDiscount === undefined || input.maximumDiscount === null
          ? null
          : toMinor(Number(input.maximumDiscount)),
      minPurchase:
        input.minimumPurchase === undefined ? null : toMinor(Number(input.minimumPurchase)),
      usageLimitGiven: input.usageLimit !== undefined,
      usageLimit: input.usageLimit ?? null,
      startsAt: input.validFrom ?? null,
      expiresAt: input.validUntil ?? null,
      isActive: input.isActive ?? null,
    }
  ).catch((error) => {
    if (error?.original?.constraint === 'coupons_code_key') {
      throw new CouponError('Coupon code already exists.');
    }
    if (error?.original?.constraint === 'coupons_within_usage_limit') {
      throw new CouponError('That usage limit is below the number of times this code has been used.');
    }
    throw error;
  });

  return publicCoupon(row);
};

export const deleteCoupon = async (couponId, db = getSequelize()) => {
  if (!isValidId(String(couponId ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM coupons WHERE id = :id', {
    replacements: { id: couponId },
  });
  return (result?.rowCount ?? 0) > 0;
};

export const listCoupons = async ({ page = 1, limit = 20 } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT ${COLUMNS} FROM coupons ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { limit, offset: (page - 1) * limit }
  );
  const counted = await selectOne(db, 'SELECT count(*)::int AS total FROM coupons');

  return { coupons: rows.map(publicCoupon), total: counted.total };
};

export const getCoupon = async (couponId, db = getSequelize()) => {
  if (!isValidId(String(couponId ?? ''))) throw new CouponError('Coupon not found.', 404);

  const row = await selectOne(db, `SELECT ${COLUMNS} FROM coupons WHERE id = :id`, { id: couponId });
  if (!row) throw new CouponError('Coupon not found.', 404);

  return publicCoupon(row);
};
