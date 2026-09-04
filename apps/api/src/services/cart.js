import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';

/**
 * Carts and wishlists, against PostgreSQL.
 *
 * Mongo stored these twice: an embedded array on the user document and a
 * near-identical array on a separate guest-session collection, with two sets of
 * handlers kept in sync by hand. They had already drifted — the guest wishlist
 * answered 400 where the user wishlist answered 200 for the same request, and
 * the guest cart keyed items by `productId` while the user cart keyed them by
 * `item` + `itemType`, so a collection could not be in a guest cart at all.
 *
 * Here there is one `carts` table with an owner arc: exactly one of
 * `customer_id` or `guest_session_id`, enforced by `carts_exactly_one_owner`.
 * Every function below takes that owner and runs the same SQL for both, so the
 * two paths cannot drift again.
 *
 * The response shape is unchanged. Both stores read cart entries as
 * `{ _id, item, itemType, quantity }` and wishlist entries as
 * `{ _id, item, itemType }`, so that is what this returns.
 *
 * Two things the database now does that the controllers used to do by hand:
 *
 *   - Pruning entries whose product was deleted. `cart_items` and
 *     `wishlist_items` reference `sellable_items` ON DELETE CASCADE, so a
 *     deleted product leaves no dangling line to sweep up on the next read.
 *   - Preventing the same item appearing twice in one cart. That is the
 *     `cart_items` primary key, not a `findIndex` over an array.
 */

export class CartError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CartError';
    this.status = status;
  }
}

/**
 * `_id` is the item's own id.
 *
 * In Mongo a cart line had a subdocument id distinct from the item it pointed
 * at; here the line *is* (cart, item), so there is no second identifier to
 * report. Publishing the item id under both names is not just convenient: the
 * cart page already calls `removeFromCart(item._id, item.itemType)` on its
 * delete button, which under Mongo passed a subdocument id where an item id was
 * expected and answered 404. That button starts working.
 */
const ITEM_TYPE = { product: 'Product', collection: 'Collection' };

const mapEntry = (row) => ({
  _id: row.sellable_item_id,
  item: row.sellable_item_id,
  itemType: ITEM_TYPE[row.kind],
});

const mapCartEntry = (row) => ({ ...mapEntry(row), quantity: row.quantity });

/** Exactly one of the two, matching the arc the database enforces. */
const assertOwner = (owner) => {
  const { customerId = null, guestSessionId = null } = owner || {};
  if ((customerId === null) === (guestSessionId === null)) {
    throw new CartError(
      'A cart belongs to exactly one of a customer or a guest session.',
      401
    );
  }
  return { customerId, guestSessionId };
};

/** 'user' or 'guest', only ever used to keep the old response wording. */
export const ownerNoun = (owner) => (owner?.customerId ? 'user' : 'guest');

const ownerWhere = (owner) =>
  owner.customerId
    ? 'customer_id = :customerId AND guest_session_id IS NULL'
    : 'guest_session_id = :guestSessionId AND customer_id IS NULL';

/**
 * Resolves the guest-session cookie to a row, creating one if it is unknown.
 *
 * The cookie outlives the row: sessions are swept by `last_seen_at`, and a
 * shopper who returns after that still holds the cookie. Treating that as an
 * error would drop their cart on the floor for no reason, so an unknown id
 * simply becomes a new session.
 */
export const ensureGuestSession = async (anonymousId, db = getSequelize()) => {
  if (!anonymousId || typeof anonymousId !== 'string') {
    throw new CartError('An anonymous ID is required.', 400);
  }

  const rows = await db.query(
    `INSERT INTO guest_sessions (anonymous_id) VALUES (:anonymousId)
     ON CONFLICT (anonymous_id) DO UPDATE SET last_seen_at = now()
     RETURNING id`,
    { replacements: { anonymousId }, type: QueryTypes.SELECT }
  );
  return rows[0].id;
};

const findCart = async (owner, db, opts = {}) => {
  const rows = await db.query(
    `SELECT id FROM carts WHERE ${ownerWhere(owner)}`,
    { replacements: owner, type: QueryTypes.SELECT, ...opts }
  );
  return rows[0]?.id ?? null;
};

/**
 * The cart row is created on first write, never on read.
 *
 * Creating one on read would mean every crawler that touches the storefront
 * leaves a row behind.
 */
const openCart = async (owner, db, opts = {}) => {
  const rows = await db.query(
    `INSERT INTO carts (customer_id, guest_session_id)
     VALUES (:customerId, :guestSessionId)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    { replacements: owner, type: QueryTypes.SELECT, ...opts }
  );
  // DO NOTHING returns nothing when the cart already existed.
  return rows[0]?.id ?? (await findCart(owner, db, opts));
};

const readCart = async (cartId, db) => {
  if (!cartId) return [];
  const rows = await db.query(
    `SELECT ci.sellable_item_id, ci.quantity, s.kind
     FROM cart_items ci
     JOIN sellable_items s ON s.id = ci.sellable_item_id
     WHERE ci.cart_id = :cartId
     ORDER BY ci.added_at, ci.sellable_item_id`,
    { replacements: { cartId }, type: QueryTypes.SELECT }
  );
  return rows.map(mapCartEntry);
};

/** The item's kind, or null when nothing sellable has that id. */
const kindOf = async (itemId, db) => {
  if (!isValidId(itemId)) return null;
  const rows = await db.query('SELECT kind FROM sellable_items WHERE id = :itemId', {
    replacements: { itemId },
    type: QueryTypes.SELECT,
  });
  return rows[0]?.kind ?? null;
};

export const getCart = async (owner, db = getSequelize()) =>
  readCart(await findCart(assertOwner(owner), db), db);

export const addToCart = async (owner, { itemId, quantity = 1 }, db = getSequelize()) => {
  assertOwner(owner);

  if (!isValidId(itemId)) throw new CartError('Invalid Item ID format.', 400);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('Quantity must be at least 1.', 400);
  }

  const kind = await kindOf(itemId, db);
  if (!kind) {
    throw new CartError('Item not found (neither Product nor Collection).', 404);
  }

  const cartId = await openCart(owner, db);
  await db.query(
    `INSERT INTO cart_items (cart_id, sellable_item_id, quantity)
     VALUES (:cartId, :itemId, :quantity)
     ON CONFLICT (cart_id, sellable_item_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    { replacements: { cartId, itemId, quantity } }
  );

  return { itemType: ITEM_TYPE[kind], cart: await readCart(cartId, db) };
};

/**
 * Sets an absolute quantity, and removes the line at zero.
 *
 * Zero-means-remove is the contract the cart page relies on for its stepper, so
 * it stays, even though `cart_items.quantity` itself may never be zero.
 */
export const setCartItemQuantity = async (
  owner,
  { itemId, itemType, quantity },
  db = getSequelize()
) => {
  assertOwner(owner);

  if (!isValidId(itemId)) throw new CartError('Invalid Item ID format.', 400);
  if (itemType !== undefined && !Object.values(ITEM_TYPE).includes(itemType)) {
    throw new CartError('Invalid item type. Must be Product or Collection.', 400);
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new CartError('Quantity must be a non-negative number.', 400);
  }

  const cartId = await findCart(owner, db);
  if (!cartId) throw new CartError('Item not found in cart.', 404);

  const sql =
    quantity === 0
      ? `DELETE FROM cart_items WHERE cart_id = :cartId AND sellable_item_id = :itemId`
      : `UPDATE cart_items SET quantity = :quantity
         WHERE cart_id = :cartId AND sellable_item_id = :itemId`;

  const [, result] = await db.query(sql, {
    replacements: { cartId, itemId, quantity },
  });

  if (result.rowCount === 0) throw new CartError('Item not found in cart.', 404);
  return readCart(cartId, db);
};

export const removeFromCart = async (owner, itemId, db = getSequelize()) => {
  assertOwner(owner);
  if (!isValidId(itemId)) throw new CartError('Invalid Item ID format.', 400);

  const cartId = await findCart(owner, db);
  if (!cartId) throw new CartError(`Item not found in ${ownerNoun(owner)} cart.`, 404);

  const [, result] = await db.query(
    `DELETE FROM cart_items WHERE cart_id = :cartId AND sellable_item_id = :itemId`,
    { replacements: { cartId, itemId } }
  );

  if (result.rowCount === 0) {
    throw new CartError(`Item not found in ${ownerNoun(owner)} cart.`, 404);
  }
  return readCart(cartId, db);
};

export const clearCart = async (owner, db = getSequelize()) => {
  assertOwner(owner);
  const cartId = await findCart(owner, db);
  if (cartId) {
    await db.query('DELETE FROM cart_items WHERE cart_id = :cartId', {
      replacements: { cartId },
    });
  }
  return [];
};

export const getWishlist = async (owner, db = getSequelize()) => {
  assertOwner(owner);
  const rows = await db.query(
    `SELECT w.sellable_item_id, s.kind
     FROM wishlist_items w
     JOIN sellable_items s ON s.id = w.sellable_item_id
     WHERE ${ownerWhere(owner)}
     ORDER BY w.added_at, w.sellable_item_id`,
    { replacements: owner, type: QueryTypes.SELECT }
  );
  return rows.map(mapEntry);
};

/**
 * Adding something already on the wishlist succeeds and changes nothing.
 *
 * Mongo answered 200 for a signed-in shopper and 400 for a guest doing the same
 * thing, and the store rolls its optimistic update back on any non-2xx — so a
 * guest tapping the heart on an item they had already saved watched it
 * disappear. One answer for both owners, and it is the harmless one.
 */
export const addToWishlist = async (owner, itemId, db = getSequelize()) => {
  assertOwner(owner);
  if (!isValidId(itemId)) throw new CartError('Invalid Item ID format.', 400);

  const kind = await kindOf(itemId, db);
  if (!kind) {
    throw new CartError('Item not found (neither Product nor Collection).', 404);
  }

  // The partial unique indexes make this safe under a race; the guard only
  // keeps the common case from raising.
  await db.query(
    `INSERT INTO wishlist_items (customer_id, guest_session_id, sellable_item_id)
     SELECT :customerId, :guestSessionId, :itemId
     WHERE NOT EXISTS (
       SELECT 1 FROM wishlist_items
       WHERE ${ownerWhere(owner)} AND sellable_item_id = :itemId
     )`,
    { replacements: { ...owner, itemId } }
  );

  return { itemType: ITEM_TYPE[kind], wishlist: await getWishlist(owner, db) };
};

export const removeFromWishlist = async (owner, itemId, db = getSequelize()) => {
  assertOwner(owner);
  if (!isValidId(itemId)) throw new CartError('Invalid Item ID format.', 400);

  const [, result] = await db.query(
    `DELETE FROM wishlist_items WHERE ${ownerWhere(owner)} AND sellable_item_id = :itemId`,
    { replacements: { ...owner, itemId } }
  );

  if (result.rowCount === 0) {
    throw new CartError(`Item not found in ${ownerNoun(owner)} wishlist.`, 404);
  }
  return getWishlist(owner, db);
};

export const clearWishlist = async (owner, db = getSequelize()) => {
  assertOwner(owner);
  await db.query(`DELETE FROM wishlist_items WHERE ${ownerWhere(owner)}`, {
    replacements: owner,
  });
  return [];
};

/**
 * Which of these ids still exist, split by kind.
 *
 * The storefront keeps a cart in browser storage before anyone signs in and
 * asks this on load so it can drop items that have since been delisted.
 */
export const checkItemExistence = async (
  { productIds = [], collectionIds = [] },
  db = getSequelize()
) => {
  const wanted = [...productIds, ...collectionIds].filter(isValidId);
  if (wanted.length === 0) {
    return { existingProductIds: [], existingCollectionIds: [] };
  }

  const rows = await db.query(
    'SELECT id, kind FROM sellable_items WHERE id IN (:wanted)',
    { replacements: { wanted }, type: QueryTypes.SELECT }
  );

  const found = new Map(rows.map((row) => [row.id, row.kind]));
  return {
    existingProductIds: productIds.filter((id) => found.get(id) === 'product'),
    existingCollectionIds: collectionIds.filter((id) => found.get(id) === 'collection'),
  };
};

/**
 * Folds a guest's cart and wishlist into the customer they just became.
 *
 * Quantities add, wishlist entries de-duplicate, and the guest session goes —
 * which takes its now-empty cart with it, because `carts.guest_session_id`
 * cascades. All of it in one transaction: a merge that half-happened would
 * either duplicate a shopper's cart or lose it.
 */
export const mergeGuestIntoCustomer = async (
  customerId,
  anonymousId,
  db = getSequelize()
) => {
  if (!customerId || !anonymousId) return { merged: false, reason: 'missing_ids' };

  // Sign-up and sign-in still run against the old store and hand back its ids.
  // Merging into one would fail on the cast; there is nothing to merge into
  // until those accounts are `customers` rows, so this is a no-op until then.
  if (!isValidId(String(customerId))) return { merged: false, reason: 'not_a_customer' };

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const sessions = await db.query(
      'SELECT id FROM guest_sessions WHERE anonymous_id = :anonymousId FOR UPDATE',
      { replacements: { anonymousId }, type: QueryTypes.SELECT, ...opts }
    );
    const guestSessionId = sessions[0]?.id;
    if (!guestSessionId) return { merged: false, reason: 'no_guest_session' };

    const guest = { customerId: null, guestSessionId };
    const customer = { customerId, guestSessionId: null };

    const guestCartId = await findCart(guest, db, opts);

    if (guestCartId) {
      const customerCartId = await openCart(customer, db, opts);

      await db.query(
        `INSERT INTO cart_items (cart_id, sellable_item_id, quantity)
         SELECT :customerCartId, sellable_item_id, quantity
         FROM cart_items WHERE cart_id = :guestCartId
         ON CONFLICT (cart_id, sellable_item_id)
         DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
        { replacements: { customerCartId, guestCartId }, ...opts }
      );
    }

    await db.query(
      `INSERT INTO wishlist_items (customer_id, sellable_item_id, added_at)
       SELECT :customerId, w.sellable_item_id, w.added_at
       FROM wishlist_items w
       WHERE w.guest_session_id = :guestSessionId
         AND NOT EXISTS (
           SELECT 1 FROM wishlist_items existing
           WHERE existing.customer_id = :customerId
             AND existing.sellable_item_id = w.sellable_item_id
         )`,
      { replacements: { customerId, guestSessionId }, ...opts }
    );

    await db.query('DELETE FROM guest_sessions WHERE id = :guestSessionId', {
      replacements: { guestSessionId },
      ...opts,
    });

    return { merged: true };
  });
};
