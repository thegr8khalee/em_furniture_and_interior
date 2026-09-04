import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { toMajor } from '../lib/money.js';

/**
 * Catalog reads, against PostgreSQL.
 *
 * The response shapes are deliberately unchanged. Both frontends read
 * `product._id`, `images[].url` and prices in naira, so this layer maps the new
 * storage back onto the old contract rather than changing both at once —
 * a rewrite that breaks the storefront in the same commit is impossible to
 * bisect when something goes wrong.
 *
 * Two differences that could not be preserved, and are not bugs:
 *
 *   - ids are UUIDs, not ObjectIds. Nothing in the frontend parses an id; it
 *     passes back whatever the API gave it.
 *   - `collectionId` was a single reference in Mongo and is a many-to-many
 *     here, so it reports the first collection a product belongs to.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidId = (value) => typeof value === 'string' && UUID.test(value);

/** Money is stored in kobo and was always published in naira. */
const money = (kobo) => (kobo === null || kobo === undefined ? undefined : toMajor(Number(kobo)));

const SELLABLE_COLUMNS = `
  s.id, s.name, s.description, s.style, s.price, s.discounted_price, s.is_promo,
  s.is_best_seller, s.is_foreign, s.origin, s.average_rating, s.review_count,
  s.created_at, s.updated_at
`;

const IMAGES = `
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('url', i.url) ORDER BY i.position) AS images
    FROM sellable_images i WHERE i.sellable_item_id = s.id
  ) img ON true
`;

const mapSellable = (row) => ({
  _id: row.id,
  name: row.name,
  description: row.description,
  style: row.style,
  price: money(row.price),
  discountedPrice: money(row.discounted_price),
  isPromo: row.is_promo,
  isBestSeller: row.is_best_seller,
  isForeign: row.is_foreign,
  origin: row.origin ?? undefined,
  averageRating: Number(row.average_rating),
  images: row.images || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapProduct = (row) => ({
  ...mapSellable(row),
  category: row.category,
  items: row.components ?? undefined,
  sku: row.sku ?? undefined,
  warehouseLocation: row.warehouse_location ?? undefined,
  // Availability, not stock on the floor: units already reserved against a
  // confirmed order are not sellable, and publishing them as if they were is
  // how a shop promises what it has already committed.
  stockQuantity: Number(row.available ?? 0),
  lowStockThreshold: row.low_stock_threshold,
  leadTimeDays: row.lead_time_days,
  shippingMinDays: row.shipping_min_days ?? undefined,
  shippingMaxDays: row.shipping_max_days ?? undefined,
  seoTitle: row.seo_title ?? undefined,
  seoDescription: row.seo_description ?? undefined,
  seoKeywords: row.seo_keywords || [],
  seoSchemaJsonLd: row.seo_schema_json_ld ?? undefined,
  collectionId: row.collection_id ? { _id: row.collection_id, name: row.collection_name } : null,
  reviews: row.reviews || [],
});

const mapCollection = (row) => ({
  ...mapSellable(row),
  coverImage: row.cover_image_url
    ? { url: row.cover_image_url, public_id: row.cover_image_public_id ?? undefined }
    : undefined,
  productIds: row.products || [],
  reviews: row.reviews || [],
});

/**
 * Turns the query string into a WHERE clause.
 *
 * Search and style were case-insensitive regexes in Mongo; ILIKE is the
 * equivalent here. Price bounds arrive in naira and are compared in kobo.
 */
const buildFilters = (query, { includeCategory = false } = {}) => {
  const where = [];
  const replacements = {};

  if (query.search && String(query.search).trim() !== '') {
    where.push('(s.name ILIKE :search OR s.description ILIKE :search)');
    replacements.search = `%${String(query.search).trim()}%`;
  }

  if (includeCategory && query.category && query.category !== 'all') {
    where.push('p.category = :category');
    replacements.category = query.category;
  }

  if (query.style) {
    where.push('s.style ILIKE :style');
    replacements.style = String(query.style).replace(/%2F/g, '/');
  }

  const minPrice = parseFloat(query.minPrice);
  const maxPrice = parseFloat(query.maxPrice);
  if (!Number.isNaN(minPrice)) {
    where.push('s.price >= :minPrice');
    replacements.minPrice = Math.round(minPrice * 100);
  }
  if (!Number.isNaN(maxPrice)) {
    where.push('s.price <= :maxPrice');
    replacements.maxPrice = Math.round(maxPrice * 100);
  }

  if (query.isBestSeller === 'true') where.push('s.is_best_seller');
  if (query.isPromo === 'true') where.push('s.is_promo');
  if (query.isForeign === 'true') where.push('s.is_foreign');

  return { where, replacements };
};

const paginate = (query) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 12;
  return { page, limit, offset: (page - 1) * limit };
};

export const listProducts = async (query = {}, db = getSequelize()) => {
  const { page, limit, offset } = paginate(query);
  const { where, replacements } = buildFilters(query, { includeCategory: true });
  const clause = where.length ? `AND ${where.join(' AND ')}` : '';

  const [{ total }] = await db.query(
    `SELECT count(*)::int AS total
     FROM sellable_items s JOIN products p ON p.id = s.id
     WHERE s.kind = 'product' ${clause}`,
    { replacements, type: QueryTypes.SELECT }
  );

  const rows = await db.query(
    `SELECT ${SELLABLE_COLUMNS},
            p.category, p.components, p.sku, p.warehouse_location, p.low_stock_threshold,
            p.lead_time_days, p.shipping_min_days, p.shipping_max_days,
            p.seo_title, p.seo_description, p.seo_keywords, p.seo_schema_json_ld,
            av.available,
            member.collection_id, ci.name AS collection_name,
            img.images
     FROM sellable_items s
     JOIN products p ON p.id = s.id
     LEFT JOIN product_availability av ON av.product_id = p.id
     LEFT JOIN LATERAL (
       SELECT cp.collection_id FROM collection_products cp
       WHERE cp.product_id = p.id ORDER BY cp.position LIMIT 1
     ) member ON true
     LEFT JOIN sellable_items ci ON ci.id = member.collection_id
     ${IMAGES}
     WHERE s.kind = 'product' ${clause}
     ORDER BY s.created_at DESC, s.id
     LIMIT :limit OFFSET :offset`,
    { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT }
  );

  return {
    products: rows.map(mapProduct),
    currentPage: page,
    totalProducts: total,
    hasMore: page * limit < total,
  };
};

export const countProducts = async (db = getSequelize()) => {
  const [{ total }] = await db.query(
    `SELECT count(*)::int AS total FROM sellable_items WHERE kind = 'product'`,
    { type: QueryTypes.SELECT }
  );
  return total;
};

/** Only approved reviews are ever published — see the schema notes on ratings. */
const REVIEWS = `
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
      '_id', r.id,
      'rating', r.rating,
      'comment', r.comment,
      'isVerifiedPurchase', r.is_verified_purchase,
      'isApproved', r.is_approved,
      'createdAt', r.created_at,
      'userId', json_build_object('_id', c.id, 'username', c.full_name)
    ) ORDER BY r.created_at DESC) AS reviews
    FROM reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.sellable_item_id = s.id AND r.is_approved
  ) rev ON true
`;

export const getProduct = async (id, db = getSequelize()) => {
  const rows = await db.query(
    `SELECT ${SELLABLE_COLUMNS},
            p.category, p.components, p.sku, p.warehouse_location, p.low_stock_threshold,
            p.lead_time_days, p.shipping_min_days, p.shipping_max_days,
            p.seo_title, p.seo_description, p.seo_keywords, p.seo_schema_json_ld,
            av.available,
            member.collection_id, ci.name AS collection_name,
            img.images, rev.reviews
     FROM sellable_items s
     JOIN products p ON p.id = s.id
     LEFT JOIN product_availability av ON av.product_id = p.id
     LEFT JOIN LATERAL (
       SELECT cp.collection_id FROM collection_products cp
       WHERE cp.product_id = p.id ORDER BY cp.position LIMIT 1
     ) member ON true
     LEFT JOIN sellable_items ci ON ci.id = member.collection_id
     ${IMAGES}
     ${REVIEWS}
     WHERE s.id = :id AND s.kind = 'product'`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  return rows[0] ? mapProduct(rows[0]) : null;
};

/** Preserves the order the caller asked for, and silently drops ids that no longer exist. */
export const getProductsByIds = async (ids, db = getSequelize()) => {
  const valid = ids.filter(isValidId);
  if (valid.length === 0) return [];

  const rows = await db.query(
    `SELECT ${SELLABLE_COLUMNS},
            p.category, p.components, p.sku, p.warehouse_location, p.low_stock_threshold,
            p.lead_time_days, p.shipping_min_days, p.shipping_max_days,
            p.seo_title, p.seo_description, p.seo_keywords, p.seo_schema_json_ld,
            av.available,
            member.collection_id, ci.name AS collection_name,
            img.images, rev.reviews
     FROM sellable_items s
     JOIN products p ON p.id = s.id
     LEFT JOIN product_availability av ON av.product_id = p.id
     LEFT JOIN LATERAL (
       SELECT cp.collection_id FROM collection_products cp
       WHERE cp.product_id = p.id ORDER BY cp.position LIMIT 1
     ) member ON true
     LEFT JOIN sellable_items ci ON ci.id = member.collection_id
     ${IMAGES}
     ${REVIEWS}
     WHERE s.id IN (:ids) AND s.kind = 'product'`,
    { replacements: { ids: valid }, type: QueryTypes.SELECT }
  );

  const byId = new Map(rows.map((row) => [row.id, mapProduct(row)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

export const listCollections = async (query = {}, db = getSequelize()) => {
  const { page, limit, offset } = paginate(query);
  const { where, replacements } = buildFilters(query);
  const clause = where.length ? `AND ${where.join(' AND ')}` : '';

  const [{ total }] = await db.query(
    `SELECT count(*)::int AS total FROM sellable_items s
     WHERE s.kind = 'collection' ${clause}`,
    { replacements, type: QueryTypes.SELECT }
  );

  const rows = await db.query(
    `SELECT ${SELLABLE_COLUMNS}, c.cover_image_url, c.cover_image_public_id, img.images
     FROM sellable_items s
     JOIN collections c ON c.id = s.id
     ${IMAGES}
     WHERE s.kind = 'collection' ${clause}
     ORDER BY s.created_at DESC, s.id
     LIMIT :limit OFFSET :offset`,
    { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT }
  );

  return {
    collections: rows.map(mapCollection),
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalCollections: total,
    hasMore: page * limit < total,
  };
};

export const countCollections = async (db = getSequelize()) => {
  const [{ total }] = await db.query(
    `SELECT count(*)::int AS total FROM sellable_items WHERE kind = 'collection'`,
    { type: QueryTypes.SELECT }
  );
  return total;
};

export const getCollection = async (id, db = getSequelize()) => {
  const rows = await db.query(
    `SELECT ${SELLABLE_COLUMNS}, c.cover_image_url, c.cover_image_public_id,
            img.images, rev.reviews, members.products
     FROM sellable_items s
     JOIN collections c ON c.id = s.id
     ${IMAGES}
     ${REVIEWS}
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         '_id', ps.id,
         'name', ps.name,
         'description', ps.description,
         'price', ps.price,
         'images', COALESCE(pi.images, '[]'::json)
       ) ORDER BY cp.position) AS products
       FROM collection_products cp
       JOIN sellable_items ps ON ps.id = cp.product_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('url', i.url) ORDER BY i.position) AS images
         FROM sellable_images i WHERE i.sellable_item_id = ps.id
       ) pi ON true
       WHERE cp.collection_id = s.id
     ) members ON true
     WHERE s.id = :id AND s.kind = 'collection'`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  if (!rows[0]) return null;

  const collection = mapCollection(rows[0]);
  // Member prices come out of the JSON aggregate in kobo; they publish in naira
  // like every other price.
  collection.productIds = collection.productIds.map((p) => ({ ...p, price: money(p.price) }));
  return collection;
};
