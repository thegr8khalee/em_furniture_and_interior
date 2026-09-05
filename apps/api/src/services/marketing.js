import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';

/**
 * Promo banners and flash sales, against PostgreSQL.
 *
 * "Live right now" is a WHERE clause here. Both endpoints used to load every
 * active row and filter the window in JavaScript, which is a table scan and a
 * decision made twice — once in the query, once in `isWithinWindow` — and the
 * two could disagree about an inclusive end date. One predicate now, in one
 * place, used by the storefront and the console alike.
 *
 * A flash sale's targeting was two parallel arrays of ids, `productIds` and
 * `collectionIds`, which nothing could join on and which stopped resolving
 * entirely when the catalog moved. Both kinds are `sellable_items`, so both are
 * rows in `flash_sale_items` and a sale's targets come back with their names.
 *
 * `discount_value` carries the same two units as a coupon's — basis points for a
 * percentage, kobo for a fixed amount — and is published as a percentage or
 * naira, as it was entered.
 */

export class MarketingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MarketingError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/** Active, started, and not finished. The one definition of "showing". */
const live = (alias = '') => {
  const column = (name) => (alias ? `${alias}.${name}` : name);
  return `${column('is_active')}
    AND (${column('starts_at')} IS NULL OR ${column('starts_at')} <= now())
    AND (${column('ends_at')} IS NULL OR ${column('ends_at')} >= now())`;
};

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

const BANNER_COLUMNS = `id, title, subtitle, image_url, link_url, position, priority,
                        is_active, starts_at, ends_at, created_at, updated_at`;

const publicBanner = (row) => ({
  _id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  imageUrl: row.image_url,
  linkUrl: row.link_url,
  position: row.position,
  priority: row.priority,
  isActive: row.is_active,
  startDate: row.starts_at,
  endDate: row.ends_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listBanners = async ({ liveOnly = false, position = null } = {}, db = getSequelize()) => {
  const where = [];
  if (liveOnly) where.push(live());
  if (position) where.push('position = :position::banner_position');

  const rows = await select(
    db,
    `SELECT ${BANNER_COLUMNS} FROM promo_banners
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY priority DESC, created_at DESC`,
    { position }
  );

  return rows.map(publicBanner);
};

export const createBanner = async (input, db = getSequelize()) => {
  const { title, imageUrl } = input || {};
  if (!title || !imageUrl) throw new MarketingError('A banner needs a title and an image.');

  const row = await selectOne(
    db,
    `INSERT INTO promo_banners (title, subtitle, image_url, link_url, position, priority,
                                is_active, starts_at, ends_at)
     VALUES (:title, :subtitle, :imageUrl, :linkUrl, :position::banner_position, :priority,
             :isActive, :startsAt, :endsAt)
     RETURNING ${BANNER_COLUMNS}`,
    {
      title,
      subtitle: input.subtitle ?? null,
      imageUrl,
      linkUrl: input.linkUrl ?? null,
      position: input.position || 'home',
      priority: Number(input.priority) || 0,
      isActive: input.isActive ?? true,
      startsAt: input.startDate ?? null,
      endsAt: input.endDate ?? null,
    }
  ).catch(rethrowBannerError(input));

  return publicBanner(row);
};

const rethrowBannerError = (input) => (error) => {
  if (error?.original?.constraint === 'banner_window_ordered') {
    throw new MarketingError('A banner cannot end before it starts.');
  }
  if (error?.original?.code === '22P02') {
    throw new MarketingError(`"${input?.position}" is not a banner position.`);
  }
  throw error;
};

export const updateBanner = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new MarketingError('Banner not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE promo_banners SET
       title = COALESCE(:title, title),
       subtitle = CASE WHEN :subtitleGiven THEN :subtitle ELSE subtitle END,
       image_url = COALESCE(:imageUrl, image_url),
       link_url = CASE WHEN :linkGiven THEN :linkUrl ELSE link_url END,
       position = COALESCE(:position::banner_position, position),
       priority = COALESCE(:priority, priority),
       is_active = COALESCE(:isActive, is_active),
       starts_at = CASE WHEN :startGiven THEN :startsAt ELSE starts_at END,
       ends_at = CASE WHEN :endGiven THEN :endsAt ELSE ends_at END
     WHERE id = :id RETURNING ${BANNER_COLUMNS}`,
    {
      id,
      title: input.title ?? null,
      subtitleGiven: input.subtitle !== undefined,
      subtitle: input.subtitle ?? null,
      imageUrl: input.imageUrl ?? null,
      linkGiven: input.linkUrl !== undefined,
      linkUrl: input.linkUrl ?? null,
      position: input.position ?? null,
      priority: input.priority === undefined ? null : Number(input.priority),
      isActive: typeof input.isActive === 'boolean' ? input.isActive : null,
      startGiven: input.startDate !== undefined,
      startsAt: input.startDate ?? null,
      endGiven: input.endDate !== undefined,
      endsAt: input.endDate ?? null,
    }
  ).catch(rethrowBannerError(input));

  if (!row) throw new MarketingError('Banner not found.', 404);
  return publicBanner(row);
};

export const deleteBanner = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM promo_banners WHERE id = :id', {
    replacements: { id },
  });
  return (result?.rowCount ?? 0) > 0;
};

// ---------------------------------------------------------------------------
// Flash sales
// ---------------------------------------------------------------------------

const FLASH_SELECT = `
  SELECT f.id, f.name, f.description, f.discount_type, f.discount_value,
         f.banner_image_url, f.is_active, f.starts_at, f.ends_at,
         f.created_at, f.updated_at,
         COALESCE(items.list, '[]'::json) AS items
    FROM flash_sales f
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('_id', s.id, 'name', s.name, 'itemType', s.kind)) AS list
        FROM flash_sale_items fi
        JOIN sellable_items s ON s.id = fi.sellable_item_id
       WHERE fi.flash_sale_id = f.id
    ) items ON true
`;

const publicFlashSale = (row) => {
  const items = row.items ?? [];

  return {
    _id: row.id,
    name: row.name,
    description: row.description,
    discountType: row.discount_type,
    discountValue:
      row.discount_type === 'percentage'
        ? Number(row.discount_value) / 100
        : toMajor(Number(row.discount_value)),
    bannerImageUrl: row.banner_image_url,
    isActive: row.is_active,
    startDate: row.starts_at,
    endDate: row.ends_at,
    items,
    // The two arrays the storefront still reads, derived from the one table.
    productIds: items.filter((item) => item.itemType === 'product').map((item) => item._id),
    collectionIds: items.filter((item) => item.itemType === 'collection').map((item) => item._id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const listFlashSales = async ({ liveOnly = false } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `${FLASH_SELECT} ${liveOnly ? `WHERE ${live('f')}` : ''} ORDER BY f.starts_at DESC`
  );
  return rows.map(publicFlashSale);
};

const storedDiscount = (type, value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new MarketingError('Discount value must be a positive number.');
  }
  if (type === 'percentage') {
    if (amount > 100) throw new MarketingError('A percentage discount cannot exceed 100%.');
    return Math.round(amount * 100);
  }
  if (type === 'fixed') return toMinor(amount);
  throw new MarketingError(`"${type}" is not a discount type.`);
};

const setTargets = async (db, saleId, productIds, collectionIds, transaction) => {
  const ids = [...(productIds ?? []), ...(collectionIds ?? [])].filter((id) =>
    isValidId(String(id ?? ''))
  );

  await db.query('DELETE FROM flash_sale_items WHERE flash_sale_id = :saleId', {
    replacements: { saleId },
    transaction,
  });

  if (ids.length === 0) return;

  // Ids that name nothing are dropped rather than refused: a sale targeting a
  // product that has since been deleted should still run for the rest.
  await db.query(
    `INSERT INTO flash_sale_items (flash_sale_id, sellable_item_id)
     SELECT :saleId, s.id FROM sellable_items s WHERE s.id IN (:ids)
     ON CONFLICT DO NOTHING`,
    { replacements: { saleId, ids }, transaction }
  );
};

export const createFlashSale = async (input, db = getSequelize()) => {
  const { name, discountType, discountValue, startDate, endDate } = input || {};

  if (!name || !discountType || discountValue === undefined || !startDate || !endDate) {
    throw new MarketingError(
      'A flash sale needs a name, a discount, and a start and end date.'
    );
  }

  const value = storedDiscount(discountType, discountValue);

  const id = await db.transaction(async (transaction) => {
    const row = await selectOne(
      db,
      `INSERT INTO flash_sales (name, description, discount_type, discount_value,
                                banner_image_url, is_active, starts_at, ends_at)
       VALUES (:name, :description, :discountType::discount_type, :discountValue,
               :bannerImageUrl, :isActive, :startsAt, :endsAt)
       RETURNING id`,
      {
        name,
        description: input.description ?? null,
        discountType,
        discountValue: value,
        bannerImageUrl: input.bannerImageUrl ?? null,
        isActive: input.isActive ?? true,
        startsAt: startDate,
        endsAt: endDate,
      },
      { transaction }
    ).catch((error) => {
      if (error?.original?.constraint === 'flash_sale_window_ordered') {
        throw new MarketingError('A flash sale cannot end before it starts.');
      }
      throw error;
    });

    await setTargets(db, row.id, input.productIds, input.collectionIds, transaction);
    return row.id;
  });

  return getFlashSale(id, db);
};

export const getFlashSale = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new MarketingError('Flash sale not found.', 404);

  const row = await selectOne(db, `${FLASH_SELECT} WHERE f.id = :id`, { id });
  if (!row) throw new MarketingError('Flash sale not found.', 404);
  return publicFlashSale(row);
};

export const updateFlashSale = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new MarketingError('Flash sale not found.', 404);

  const existing = await selectOne(
    db,
    'SELECT discount_type, discount_value FROM flash_sales WHERE id = :id',
    { id }
  );
  if (!existing) throw new MarketingError('Flash sale not found.', 404);

  const discountType = input.discountType ?? existing.discount_type;
  const discountValue =
    input.discountValue === undefined
      ? Number(existing.discount_value)
      : storedDiscount(discountType, input.discountValue);

  await db.transaction(async (transaction) => {
    await db
      .query(
        `UPDATE flash_sales SET
           name = COALESCE(:name, name),
           description = CASE WHEN :descriptionGiven THEN :description ELSE description END,
           discount_type = :discountType::discount_type,
           discount_value = :discountValue,
           banner_image_url = CASE WHEN :bannerGiven THEN :bannerImageUrl ELSE banner_image_url END,
           is_active = COALESCE(:isActive, is_active),
           starts_at = COALESCE(:startsAt, starts_at),
           ends_at = COALESCE(:endsAt, ends_at)
         WHERE id = :id`,
        {
          replacements: {
            id,
            name: input.name ?? null,
            descriptionGiven: input.description !== undefined,
            description: input.description ?? null,
            discountType,
            discountValue,
            bannerGiven: input.bannerImageUrl !== undefined,
            bannerImageUrl: input.bannerImageUrl ?? null,
            isActive: typeof input.isActive === 'boolean' ? input.isActive : null,
            startsAt: input.startDate ?? null,
            endsAt: input.endDate ?? null,
          },
          transaction,
        }
      )
      .catch((error) => {
        if (error?.original?.constraint === 'flash_sale_window_ordered') {
          throw new MarketingError('A flash sale cannot end before it starts.');
        }
        throw error;
      });

    if (input.productIds !== undefined || input.collectionIds !== undefined) {
      await setTargets(db, id, input.productIds, input.collectionIds, transaction);
    }
  });

  return getFlashSale(id, db);
};

export const deleteFlashSale = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM flash_sales WHERE id = :id', {
    replacements: { id },
  });
  return (result?.rowCount ?? 0) > 0;
};
