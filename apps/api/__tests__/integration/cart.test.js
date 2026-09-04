import { jest } from '@jest/globals';
import request from 'supertest';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  currentDatabaseUrl,
  insertProduct,
  insertCollection,
  insertCustomer,
  insertGuestSession,
} from '../helpers/database.js';
import * as cart from '../../src/services/cart.js';

// Carts and wishlists, over HTTP and through the service.
//
// The guest path is exercised over HTTP because that is how it reaches
// production: an `anonymousId` cookie and nothing else. The signed-in path is
// exercised through the service, because sign-in still runs against the old
// store and cannot mint a `customers` row yet — testing it through a fake login
// would prove only that the fake works.

jest.setTimeout(30000);

let app;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

/** A fresh anonymous shopper, so no two tests share a cart. */
const guest = () => `anon-${Math.random().toString(36).slice(2)}`;
const asGuest = (id) => [`anonymousId=${id}`];

describe('the guest cart over HTTP', () => {
  let productId;
  let collectionId;

  beforeAll(async () => {
    productId = await insertProduct({ name: 'Milano Sofa', price: 45000000 });
    collectionId = await insertCollection({ name: 'Milano Set', price: 120000000 });
  });

  it('is empty for a shopper who has never added anything', async () => {
    const res = await request(app).get('/api/cart').set('Cookie', asGuest(guest()));

    expect(res.status).toBe(200);
    expect(res.body.cart).toEqual([]);
  });

  it('adds a product and reports it in the shape the storefront reads', async () => {
    const cookie = asGuest(guest());

    const res = await request(app)
      .put('/api/cart/add')
      .set('Cookie', cookie)
      .send({ itemId: productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Product added to guest cart successfully.');
    expect(res.body.cart).toEqual([
      { _id: productId, item: productId, itemType: 'Product', quantity: 2 },
    ]);
  });

  it('carries the cart across requests on the same cookie', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: productId });

    const res = await request(app).get('/api/cart').set('Cookie', cookie);

    expect(res.body.cart).toHaveLength(1);
    expect(res.body.cart[0].quantity).toBe(1);
  });

  it('holds collections as well as products', async () => {
    const cookie = asGuest(guest());
    const res = await request(app)
      .put('/api/cart/add')
      .set('Cookie', cookie)
      .send({ itemId: collectionId });

    expect(res.body.message).toBe('Collection added to guest cart successfully.');
    expect(res.body.cart[0].itemType).toBe('Collection');
  });

  it('adds to the quantity rather than making a second line', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: productId, quantity: 2 });
    const res = await request(app)
      .put('/api/cart/add')
      .set('Cookie', cookie)
      .send({ itemId: productId, quantity: 3 });

    expect(res.body.cart).toHaveLength(1);
    expect(res.body.cart[0].quantity).toBe(5);
  });

  it('refuses an id that is not an id, and one that names nothing', async () => {
    const cookie = asGuest(guest());

    const malformed = await request(app)
      .put('/api/cart/add')
      .set('Cookie', cookie)
      .send({ itemId: 'not-an-id' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.message).toBe('Invalid Item ID format.');

    const missing = await request(app)
      .put('/api/cart/add')
      .set('Cookie', cookie)
      .send({ itemId: '00000000-0000-4000-8000-000000000000' });
    expect(missing.status).toBe(404);
  });

  it('refuses a quantity below one', async () => {
    const res = await request(app)
      .put('/api/cart/add')
      .set('Cookie', asGuest(guest()))
      .send({ itemId: productId, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Quantity must be at least 1.');
  });

  it('sets an absolute quantity, and removes the line at zero', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: productId, quantity: 4 });

    const updated = await request(app)
      .put('/api/cart/updatequantity')
      .set('Cookie', cookie)
      .send({ itemId: productId, itemType: 'Product', quantity: 2 });
    expect(updated.body.cart[0].quantity).toBe(2);

    const zeroed = await request(app)
      .put('/api/cart/updatequantity')
      .set('Cookie', cookie)
      .send({ itemId: productId, itemType: 'Product', quantity: 0 });
    expect(zeroed.body.cart).toEqual([]);
  });

  it('removes an item, and says so when there was none to remove', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: productId });

    const removed = await request(app)
      .put('/api/cart/remove')
      .set('Cookie', cookie)
      .send({ itemId: productId });
    expect(removed.status).toBe(200);
    expect(removed.body.cart).toEqual([]);

    const again = await request(app)
      .put('/api/cart/remove')
      .set('Cookie', cookie)
      .send({ itemId: productId });
    expect(again.status).toBe(404);
    expect(again.body.message).toBe('Item not found in guest cart.');
  });

  it('clears the cart', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: productId });
    await request(app).put('/api/cart/add').set('Cookie', cookie).send({ itemId: collectionId });

    const res = await request(app).delete('/api/cart/clear').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.cart).toEqual([]);

    const after = await request(app).get('/api/cart').set('Cookie', cookie);
    expect(after.body.cart).toEqual([]);
  });

  it('serves a guest with no cookie at all, and hands them one', async () => {
    // This is the case the old `identifyGuest, protectRoute` chain answered 401
    // to — every first-time visitor.
    const res = await request(app).get('/api/cart');

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'].join(';')).toContain('anonymousId=');
  });
});

describe('the wishlist over HTTP', () => {
  let productId;

  beforeAll(async () => {
    productId = await insertProduct({ name: 'Oslo Chair', price: 9000000 });
  });

  it('adds an item and reads it back', async () => {
    const cookie = asGuest(guest());

    const added = await request(app)
      .put('/api/wishlist/add')
      .set('Cookie', cookie)
      .send({ itemId: productId });
    expect(added.status).toBe(200);
    expect(added.body.wishlist).toEqual([
      { _id: productId, item: productId, itemType: 'Product' },
    ]);

    const read = await request(app).get('/api/wishlist').set('Cookie', cookie);
    expect(read.body.wishlist).toHaveLength(1);
  });

  it('accepts a second add of the same item without duplicating or failing', async () => {
    // Mongo answered 400 here for guests and 200 for signed-in shoppers; the
    // store rolls its optimistic update back on any non-2xx, so the guest saw
    // the item vanish.
    const cookie = asGuest(guest());
    await request(app).put('/api/wishlist/add').set('Cookie', cookie).send({ itemId: productId });

    const res = await request(app)
      .put('/api/wishlist/add')
      .set('Cookie', cookie)
      .send({ itemId: productId });

    expect(res.status).toBe(200);
    expect(res.body.wishlist).toHaveLength(1);
  });

  it('removes an item, and 404s when it was not there', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/wishlist/add').set('Cookie', cookie).send({ itemId: productId });

    const removed = await request(app)
      .put('/api/wishlist/remove')
      .set('Cookie', cookie)
      .send({ itemId: productId });
    expect(removed.body.wishlist).toEqual([]);

    const again = await request(app)
      .put('/api/wishlist/remove')
      .set('Cookie', cookie)
      .send({ itemId: productId });
    expect(again.status).toBe(404);
  });

  it('clears the wishlist', async () => {
    const cookie = asGuest(guest());
    await request(app).put('/api/wishlist/add').set('Cookie', cookie).send({ itemId: productId });

    const res = await request(app).delete('/api/wishlist/clear').set('Cookie', cookie);
    expect(res.body.wishlist).toEqual([]);
  });
});

describe('POST /api/cart/check-existence and /api/cart/details-by-ids', () => {
  let productId;
  let collectionId;

  beforeAll(async () => {
    productId = await insertProduct({ name: 'Lagos Table', price: 15000000 });
    collectionId = await insertCollection({ name: 'Lagos Set', price: 30000000 });
    await getDb().query(
      `INSERT INTO sellable_images (sellable_item_id, url, position) VALUES (:id, :url, 0)`,
      { replacements: { id: productId, url: 'https://cdn.example.com/lagos.png' } }
    );
  });

  it('reports which ids still exist, and does not confuse the two kinds', async () => {
    const res = await request(app)
      .post('/api/cart/check-existence')
      .send({
        productIds: [productId, collectionId, '00000000-0000-4000-8000-000000000000'],
        collectionIds: [collectionId, productId],
      });

    expect(res.status).toBe(200);
    // A collection id passed as a product id is not a product.
    expect(res.body.existingProductIds).toEqual([productId]);
    expect(res.body.existingCollectionIds).toEqual([collectionId]);
  });

  it('tolerates ids that are not ids at all', async () => {
    const res = await request(app)
      .post('/api/cart/check-existence')
      .send({ productIds: ['deadbeef', null], collectionIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.existingProductIds).toEqual([]);
  });

  it('returns details in naira with images, for both kinds', async () => {
    const res = await request(app)
      .post('/api/cart/details-by-ids')
      .send({ productIds: [productId], collectionIds: [collectionId] });

    expect(res.status).toBe(200);
    expect(res.body.products[0]).toMatchObject({
      _id: productId,
      name: 'Lagos Table',
      price: 150000,
      images: [{ url: 'https://cdn.example.com/lagos.png' }],
    });
    expect(res.body.collections[0]).toMatchObject({ _id: collectionId, price: 300000 });
  });
});

describe('the signed-in cart, through the service', () => {
  let customerId;
  let productId;

  beforeAll(async () => {
    customerId = await insertCustomer();
    productId = await insertProduct({ name: 'Kano Bench', price: 5000000 });
  });

  const owner = () => ({ customerId, guestSessionId: null });

  it('runs the same code as the guest cart', async () => {
    const { cart: items } = await cart.addToCart(owner(), { itemId: productId, quantity: 3 }, getDb());

    expect(items).toEqual([
      { _id: productId, item: productId, itemType: 'Product', quantity: 3 },
    ]);
    expect(await cart.getCart(owner(), getDb())).toEqual(items);
  });

  it('refuses an owner that is both, or neither', async () => {
    const both = { customerId, guestSessionId: await insertGuestSession() };
    await expect(cart.getCart(both, getDb())).rejects.toThrow(cart.CartError);
    await expect(cart.getCart({}, getDb())).rejects.toThrow(cart.CartError);
  });
});

describe('the database keeps a cart honest', () => {
  it('will not let a cart belong to both a customer and a guest', async () => {
    const customerId = await insertCustomer();
    const guestSessionId = await insertGuestSession();

    await expect(
      getDb().query(
        `INSERT INTO carts (customer_id, guest_session_id) VALUES (:customerId, :guestSessionId)`,
        { replacements: { customerId, guestSessionId } }
      )
    ).rejects.toThrow(/carts_exactly_one_owner/);
  });

  it('drops cart and wishlist lines when the item is deleted', async () => {
    const guestSessionId = await insertGuestSession();
    const owner = { customerId: null, guestSessionId };
    const productId = await insertProduct({ name: 'Doomed Stool', price: 100000 });

    await cart.addToCart(owner, { itemId: productId }, getDb());
    await cart.addToWishlist(owner, productId, getDb());

    await getDb().query('DELETE FROM sellable_items WHERE id = :id', {
      replacements: { id: productId },
    });

    // The old controllers swept these up in JavaScript on every read.
    expect(await cart.getCart(owner, getDb())).toEqual([]);
    expect(await cart.getWishlist(owner, getDb())).toEqual([]);
  });
});

describe('merging a guest into the customer they became', () => {
  it('adds quantities, de-duplicates the wishlist, and takes the session with it', async () => {
    const customerId = await insertCustomer();
    const anonymousId = guest();
    const guestSessionId = await cart.ensureGuestSession(anonymousId, getDb());

    const shared = await insertProduct({ name: 'Shared Sofa', price: 1000000 });
    const guestOnly = await insertProduct({ name: 'Guest Lamp', price: 200000 });

    const asCustomer = { customerId, guestSessionId: null };
    const asGuestOwner = { customerId: null, guestSessionId };

    await cart.addToCart(asCustomer, { itemId: shared, quantity: 1 }, getDb());
    await cart.addToWishlist(asCustomer, shared, getDb());

    await cart.addToCart(asGuestOwner, { itemId: shared, quantity: 2 }, getDb());
    await cart.addToCart(asGuestOwner, { itemId: guestOnly, quantity: 1 }, getDb());
    await cart.addToWishlist(asGuestOwner, shared, getDb());
    await cart.addToWishlist(asGuestOwner, guestOnly, getDb());

    const result = await cart.mergeGuestIntoCustomer(customerId, anonymousId, getDb());
    expect(result).toEqual({ merged: true });

    const merged = await cart.getCart(asCustomer, getDb());
    expect(merged).toHaveLength(2);
    expect(merged.find((line) => line.item === shared).quantity).toBe(3);

    const wishlist = await cart.getWishlist(asCustomer, getDb());
    expect(wishlist.map((entry) => entry.item).sort()).toEqual([shared, guestOnly].sort());

    const [sessions] = await getDb().query(
      'SELECT id FROM guest_sessions WHERE anonymous_id = :anonymousId',
      { replacements: { anonymousId } }
    );
    expect(sessions).toEqual([]);
  });

  it('is a no-op when there is no guest session, and when the id is not a customer', async () => {
    const customerId = await insertCustomer();

    expect(await cart.mergeGuestIntoCustomer(customerId, guest(), getDb())).toEqual({
      merged: false,
      reason: 'no_guest_session',
    });
    // A Mongo ObjectId, which is what sign-in still produces.
    expect(
      await cart.mergeGuestIntoCustomer('507f1f77bcf86cd799439011', guest(), getDb())
    ).toEqual({ merged: false, reason: 'not_a_customer' });
  });
});
