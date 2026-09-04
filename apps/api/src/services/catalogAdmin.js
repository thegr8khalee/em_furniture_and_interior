import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { toMinor } from '../lib/money.js';
import { logger } from '../lib/logger.js';
import { cloudinaryStore, destroyQuietly } from './imageStore.js';
import { getProduct, getCollection, isValidId } from './catalog.js';

/**
 * Catalog writes, against PostgreSQL.
 *
 * The validation rules are carried over from admin.controller.js unchanged,
 * including the ones the database now also enforces. Keeping both is
 * deliberate: the constraint is the guarantee, the check is the error message.
 * A 400 saying "discounted price must be less than the original price" is
 * usable; a raw constraint violation is not.
 *
 * One rule the database did NOT have and the controller did: a discounted price
 * must be strictly BELOW the list price. The schema allows equal, so this stays
 * an application rule.
 */

export class CatalogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const IMAGE_FOLDER = { product: 'furniture_products', collection: 'furniture_collections' };

/* ─────────────────────────────── parsing ─────────────────────────────── */

const optionalInt = (value) => {
  if (value === undefined || value === '' || value === null) return undefined;
  return parseInt(value, 10);
};

/**
 * Postgres text[] from a JS array.
 *
 * Sequelize expands an array replacement into a comma-separated list, which is
 * correct for `IN (...)` and produces invalid SQL for an array column — an
 * empty array yields `VALUES (, )`. Going through JSON keeps the escaping
 * right and handles the empty case.
 */
const parseKeywords = (seoKeywords) => {
  const raw = Array.isArray(seoKeywords)
    ? seoKeywords
    : typeof seoKeywords === 'string'
      ? seoKeywords.split(',')
      : [];
  return raw.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
};

/**
 * Validates the commercial fields shared by products and collections.
 *
 * Prices arrive from the form in naira and are converted here, once — the one
 * place a fractional value could otherwise reach the database and be rounded
 * silently.
 */
const validateCommercials = ({ price, discountedPrice, isPromo, isForeign, origin }) => {
  const listPrice = parseFloat(price);
  const promoPrice =
    discountedPrice !== '' && discountedPrice !== undefined && discountedPrice !== null
      ? parseFloat(discountedPrice)
      : undefined;

  if (isPromo && (promoPrice === undefined || Number.isNaN(promoPrice))) {
    throw new CatalogError(
      'Discounted price is required and must be a valid number if product is on promotion.'
    );
  }
  if (promoPrice !== undefined && promoPrice >= listPrice) {
    throw new CatalogError('Discounted price must be less than the original price.');
  }
  if (listPrice < 0 || (promoPrice !== undefined && promoPrice < 0)) {
    throw new CatalogError('Price and discounted price must be non-negative.');
  }
  if (isForeign && !origin) {
    throw new CatalogError('Origin is required if product is foreign.');
  }

  return {
    price: toMinor(listPrice),
    // Only stored when the promotion is on, matching the previous behaviour of
    // leaving a stale discount off the document entirely.
    discountedPrice: isPromo && promoPrice !== undefined ? toMinor(promoPrice) : null,
  };
};

const validateShipping = ({ leadTimeDays, shippingMinDays, shippingMaxDays }) => {
  const lead = optionalInt(leadTimeDays);
  const min = optionalInt(shippingMinDays);
  const max = optionalInt(shippingMaxDays);

  if (lead !== undefined && (Number.isNaN(lead) || lead < 0)) {
    throw new CatalogError('Lead time days must be a non-negative number.');
  }
  if (min !== undefined && (Number.isNaN(min) || min < 0)) {
    throw new CatalogError('Shipping min days must be a non-negative number.');
  }
  if (max !== undefined && (Number.isNaN(max) || max < 0)) {
    throw new CatalogError('Shipping max days must be a non-negative number.');
  }
  if (min !== undefined && max !== undefined && max < min) {
    throw new CatalogError('Shipping max days must be >= shipping min days.');
  }

  return { lead: lead ?? 0, min: min ?? null, max: max ?? null };
};

/* ──────────────────────────────── images ─────────────────────────────── */

/**
 * Uploads any base64 payloads in an image list, and reports what to keep.
 *
 * The frontend sends three shapes, which the previous controller distinguished
 * inline and which are preserved here:
 *
 *   { url, public_id: true }  an existing image, keep it as-is
 *   { url, isNew: true }      a base64 payload to upload
 *   "data:image/..."          a bare base64 string, on create
 *
 * Anything else is skipped with a warning rather than failing the whole save —
 * one malformed entry should not lose the other nine.
 */
const resolveImages = async (incoming, folder, store) => {
  const resolved = [];
  if (!Array.isArray(incoming)) return resolved;

  for (const entry of incoming) {
    if (typeof entry === 'string') {
      if (!entry.startsWith('data:image')) {
        logger.warn('Skipping invalid image data');
        continue;
      }
      resolved.push(await store.upload(entry, folder));
      continue;
    }

    if (entry && typeof entry === 'object' && entry.url) {
      if (entry.isNew) {
        if (typeof entry.url === 'string' && entry.url.startsWith('data:image')) {
          resolved.push(await store.upload(entry.url, folder));
        } else {
          logger.warn('Skipping invalid new image data (not a Base64 string)');
        }
        continue;
      }
      // An existing image being kept. public_id may be the marker `true` the
      // frontend sends, or the real handle.
      resolved.push({
        url: entry.url,
        publicId: typeof entry.public_id === 'string' ? entry.public_id : entry.publicId ?? null,
        existing: true,
      });
      continue;
    }

    logger.warn('Skipping unrecognized image data format');
  }

  return resolved;
};

/** Replaces an item's images, deleting whatever is no longer referenced. */
const replaceImages = async (db, itemId, resolved, store, transaction) => {
  const previous = await db.query(
    'SELECT url, public_id FROM sellable_images WHERE sellable_item_id = :id',
    { replacements: { id: itemId }, type: QueryTypes.SELECT, transaction }
  );

  await db.query('DELETE FROM sellable_images WHERE sellable_item_id = :id', {
    replacements: { id: itemId },
    transaction,
  });

  for (const [position, image] of resolved.entries()) {
    await db.query(
      `INSERT INTO sellable_images (sellable_item_id, url, public_id, position)
       VALUES (:id, :url, :publicId, :position)`,
      {
        replacements: { id: itemId, url: image.url, publicId: image.publicId ?? null, position },
        transaction,
      }
    );
  }

  // Orphans, by URL: the frontend's "keep" marker does not always carry the
  // real public_id back, so matching on it alone would delete images that are
  // still in use.
  const keptUrls = new Set(resolved.map((i) => i.url));
  return previous.filter((p) => p.public_id && !keptUrls.has(p.url)).map((p) => p.public_id);
};

/* ─────────────────────────────── products ────────────────────────────── */

const assertCollectionExists = async (db, collectionId, transaction) => {
  if (!collectionId) return null;
  if (!isValidId(collectionId)) throw new CatalogError('Invalid Collection ID format.');

  const rows = await db.query(
    `SELECT id FROM sellable_items WHERE id = :id AND kind = 'collection'`,
    { replacements: { id: collectionId }, type: QueryTypes.SELECT, transaction }
  );
  if (!rows[0]) throw new CatalogError('Collection not found with the provided ID.', 404);
  return collectionId;
};

/** A product sits in at most one collection; migration 0009 enforces it. */
const setCollectionMembership = async (db, productId, collectionId, transaction) => {
  await db.query('DELETE FROM collection_products WHERE product_id = :productId', {
    replacements: { productId },
    transaction,
  });
  if (collectionId) {
    await db.query(
      `INSERT INTO collection_products (collection_id, product_id) VALUES (:collectionId, :productId)`,
      { replacements: { collectionId, productId }, transaction }
    );
  }
};

export const createProduct = async (body, { db = getSequelize(), store = cloudinaryStore } = {}) => {
  const { name, description, category, items, style, collectionId, images } = body;

  if (!name || !description || !body.price || !category || !style) {
    throw new CatalogError(
      'Please enter all required product fields: name, description, price, category.'
    );
  }

  const { price, discountedPrice } = validateCommercials(body);
  const { lead, min, max } = validateShipping(body);
  const keywords = parseKeywords(body.seoKeywords);

  // Uploads happen before the transaction opens: an image push is slow and
  // holding a database transaction across it would keep row locks for the
  // duration of a network round trip.
  const resolved = await resolveImages(images, IMAGE_FOLDER.product, store);

  const id = await db.transaction(async (transaction) => {
    await assertCollectionExists(db, collectionId, transaction);

    const [[item]] = await db.query(
      `INSERT INTO sellable_items
         (kind, name, description, style, price, is_promo, discounted_price,
          is_best_seller, is_foreign, origin)
       VALUES ('product', :name, :description, :style, :price, :isPromo, :discountedPrice,
               :isBestSeller, :isForeign, :origin)
       RETURNING id`,
      {
        replacements: {
          name,
          description,
          style,
          price,
          isPromo: Boolean(body.isPromo),
          discountedPrice,
          isBestSeller: Boolean(body.isBestSeller),
          isForeign: Boolean(body.isForeign),
          origin: body.isForeign ? body.origin : null,
        },
        transaction,
      }
    );

    await db.query(
      `INSERT INTO products
         (id, category, components, lead_time_days, shipping_min_days, shipping_max_days,
          seo_title, seo_description, seo_keywords, seo_schema_json_ld)
       VALUES (:id, :category, :components, :lead, :min, :max,
               :seoTitle, :seoDescription, ARRAY(SELECT json_array_elements_text(:keywords::json)), :jsonLd)`,
      {
        replacements: {
          id: item.id,
          category,
          components: items ?? null,
          lead,
          min,
          max,
          seoTitle: body.seoTitle || null,
          seoDescription: body.seoDescription || null,
          keywords: JSON.stringify(keywords),
          jsonLd: body.seoSchemaJsonLd || null,
        },
        transaction,
      }
    );

    await replaceImages(db, item.id, resolved, store, transaction);
    await setCollectionMembership(db, item.id, collectionId || null, transaction);

    return item.id;
  });

  return getProduct(id, db);
};

export const updateProduct = async (
  productId,
  body,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(productId)) throw new CatalogError('Invalid Product ID format.');

  const existing = await getProduct(productId, db);
  if (!existing) throw new CatalogError('Product not found.', 404);

  // Validate against the merged result, so a partial update cannot produce a
  // combination the individual fields would each have passed.
  const merged = {
    price: body.price ?? existing.price,
    discountedPrice: body.discountedPrice ?? existing.discountedPrice,
    isPromo: body.isPromo ?? existing.isPromo,
    isForeign: body.isForeign ?? existing.isForeign,
    origin: body.origin ?? existing.origin,
  };
  const { price, discountedPrice } = validateCommercials(merged);
  const shipping = validateShipping({
    leadTimeDays: body.leadTimeDays ?? existing.leadTimeDays,
    shippingMinDays: body.shippingMinDays ?? existing.shippingMinDays,
    shippingMaxDays: body.shippingMaxDays ?? existing.shippingMaxDays,
  });

  const resolved =
    body.images === undefined
      ? null
      : await resolveImages(body.images, IMAGE_FOLDER.product, store);

  const orphans = await db.transaction(async (transaction) => {
    if (body.collectionId !== undefined) {
      await assertCollectionExists(db, body.collectionId, transaction);
    }

    await db.query(
      `UPDATE sellable_items SET
         name = COALESCE(:name, name),
         description = COALESCE(:description, description),
         style = COALESCE(:style, style),
         price = :price,
         is_promo = :isPromo,
         discounted_price = :discountedPrice,
         is_best_seller = COALESCE(:isBestSeller, is_best_seller),
         is_foreign = :isForeign,
         origin = :origin
       WHERE id = :id`,
      {
        replacements: {
          id: productId,
          name: body.name ?? null,
          description: body.description ?? null,
          style: body.style ?? null,
          price,
          isPromo: Boolean(merged.isPromo),
          discountedPrice,
          isBestSeller: body.isBestSeller ?? null,
          isForeign: Boolean(merged.isForeign),
          origin: merged.isForeign ? merged.origin : null,
        },
        transaction,
      }
    );

    await db.query(
      `UPDATE products SET
         category = COALESCE(:category, category),
         components = COALESCE(:components, components),
         lead_time_days = :lead,
         shipping_min_days = :min,
         shipping_max_days = :max,
         seo_title = COALESCE(:seoTitle, seo_title),
         seo_description = COALESCE(:seoDescription, seo_description),
         seo_keywords = CASE WHEN :keywords::json IS NULL THEN seo_keywords
                             ELSE ARRAY(SELECT json_array_elements_text(:keywords::json)) END,
         seo_schema_json_ld = COALESCE(:jsonLd, seo_schema_json_ld)
       WHERE id = :id`,
      {
        replacements: {
          id: productId,
          category: body.category ?? null,
          components: body.items ?? null,
          lead: shipping.lead,
          min: shipping.min,
          max: shipping.max,
          seoTitle: body.seoTitle ?? null,
          seoDescription: body.seoDescription ?? null,
          keywords:
            body.seoKeywords === undefined ? null : JSON.stringify(parseKeywords(body.seoKeywords)),
          jsonLd: body.seoSchemaJsonLd ?? null,
        },
        transaction,
      }
    );

    const removed = resolved
      ? await replaceImages(db, productId, resolved, store, transaction)
      : [];

    if (body.collectionId !== undefined) {
      await setCollectionMembership(db, productId, body.collectionId || null, transaction);
    }

    return removed;
  });

  // Only once the record is committed. Deleting first would lose the file if
  // the transaction then rolled back.
  for (const publicId of orphans) await destroyQuietly(store, publicId);

  return getProduct(productId, db);
};

export const deleteProduct = async (
  productId,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(productId)) throw new CatalogError('Invalid Product ID format.');

  const images = await db.query(
    'SELECT public_id FROM sellable_images WHERE sellable_item_id = :id',
    { replacements: { id: productId }, type: QueryTypes.SELECT }
  );

  const [, result] = await db.query(
    `DELETE FROM sellable_items WHERE id = :id AND kind = 'product'`,
    { replacements: { id: productId } }
  );

  if (result.rowCount === 0) throw new CatalogError('Product not found.', 404);

  for (const image of images) await destroyQuietly(store, image.public_id);
};

/* ────────────────────────────── collections ──────────────────────────── */

export const createCollection = async (
  body,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  const { name, description, style, productIds, coverImage } = body;

  if (!name || !body.price || !style) {
    throw new CatalogError('Please enter all required collection fields: name, price, style.');
  }

  const { price, discountedPrice } = validateCommercials(body);
  const cover = coverImage
    ? (await resolveImages([coverImage], IMAGE_FOLDER.collection, store))[0]
    : null;

  const id = await db.transaction(async (transaction) => {
    const [[item]] = await db.query(
      `INSERT INTO sellable_items
         (kind, name, description, style, price, is_promo, discounted_price,
          is_best_seller, is_foreign, origin)
       VALUES ('collection', :name, :description, :style, :price, :isPromo, :discountedPrice,
               :isBestSeller, :isForeign, :origin)
       RETURNING id`,
      {
        replacements: {
          name,
          description: description ?? null,
          style,
          price,
          isPromo: Boolean(body.isPromo),
          discountedPrice,
          isBestSeller: Boolean(body.isBestSeller),
          isForeign: Boolean(body.isForeign),
          origin: body.isForeign ? body.origin : null,
        },
        transaction,
      }
    );

    await db.query(
      `INSERT INTO collections (id, cover_image_url, cover_image_public_id)
       VALUES (:id, :url, :publicId)`,
      {
        replacements: { id: item.id, url: cover?.url ?? null, publicId: cover?.publicId ?? null },
        transaction,
      }
    );

    await setMembers(db, item.id, productIds, transaction);
    return item.id;
  });

  return getCollection(id, db);
};

/**
 * Sets a collection's members.
 *
 * Because a product belongs to at most one collection, adding it here removes
 * it from wherever it was — which is what the previous controller did by hand
 * across two documents.
 */
const setMembers = async (db, collectionId, productIds, transaction) => {
  if (productIds === undefined) return;

  await db.query('DELETE FROM collection_products WHERE collection_id = :collectionId', {
    replacements: { collectionId },
    transaction,
  });

  const valid = (productIds || []).filter(isValidId);
  for (const [position, productId] of valid.entries()) {
    const rows = await db.query(
      `SELECT id FROM sellable_items WHERE id = :id AND kind = 'product'`,
      { replacements: { id: productId }, type: QueryTypes.SELECT, transaction }
    );
    if (!rows[0]) {
      logger.warn({ productId }, 'Skipping collection member that is not a product');
      continue;
    }
    await db.query('DELETE FROM collection_products WHERE product_id = :productId', {
      replacements: { productId },
      transaction,
    });
    await db.query(
      `INSERT INTO collection_products (collection_id, product_id, position)
       VALUES (:collectionId, :productId, :position)`,
      { replacements: { collectionId, productId, position }, transaction }
    );
  }
};

export const updateCollection = async (
  collectionId,
  body,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(collectionId)) throw new CatalogError('Invalid Collection ID format.');

  const existing = await getCollection(collectionId, db);
  if (!existing) throw new CatalogError('Collection not found.', 404);

  const merged = {
    price: body.price ?? existing.price,
    discountedPrice: body.discountedPrice ?? existing.discountedPrice,
    isPromo: body.isPromo ?? existing.isPromo,
    isForeign: body.isForeign ?? existing.isForeign,
    origin: body.origin ?? existing.origin,
  };
  const { price, discountedPrice } = validateCommercials(merged);

  let cover;
  if (body.coverImage !== undefined) {
    cover = body.coverImage
      ? (await resolveImages([body.coverImage], IMAGE_FOLDER.collection, store))[0]
      : null;
  }

  await db.transaction(async (transaction) => {
    await db.query(
      `UPDATE sellable_items SET
         name = COALESCE(:name, name),
         description = COALESCE(:description, description),
         style = COALESCE(:style, style),
         price = :price,
         is_promo = :isPromo,
         discounted_price = :discountedPrice,
         is_best_seller = COALESCE(:isBestSeller, is_best_seller),
         is_foreign = :isForeign,
         origin = :origin
       WHERE id = :id`,
      {
        replacements: {
          id: collectionId,
          name: body.name ?? null,
          description: body.description ?? null,
          style: body.style ?? null,
          price,
          isPromo: Boolean(merged.isPromo),
          discountedPrice,
          isBestSeller: body.isBestSeller ?? null,
          isForeign: Boolean(merged.isForeign),
          origin: merged.isForeign ? merged.origin : null,
        },
        transaction,
      }
    );

    if (cover !== undefined) {
      await db.query(
        `UPDATE collections SET cover_image_url = :url, cover_image_public_id = :publicId
         WHERE id = :id`,
        {
          replacements: { id: collectionId, url: cover?.url ?? null, publicId: cover?.publicId ?? null },
          transaction,
        }
      );
    }

    await setMembers(db, collectionId, body.productIds, transaction);
  });

  const oldPublicId = existing.coverImage?.public_id;
  if (cover !== undefined && oldPublicId && oldPublicId !== cover?.publicId) {
    await destroyQuietly(store, oldPublicId);
  }

  return getCollection(collectionId, db);
};

export const deleteCollection = async (
  collectionId,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(collectionId)) throw new CatalogError('Invalid Collection ID format.');

  const rows = await db.query(
    `SELECT c.cover_image_public_id FROM collections c WHERE c.id = :id`,
    { replacements: { id: collectionId }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) throw new CatalogError('Collection not found.', 404);

  // Members survive; deleting a set does not delete the furniture in it. The
  // membership rows go with the collection by cascade.
  await db.query(`DELETE FROM sellable_items WHERE id = :id AND kind = 'collection'`, {
    replacements: { id: collectionId },
  });

  await destroyQuietly(store, rows[0].cover_image_public_id);
};
