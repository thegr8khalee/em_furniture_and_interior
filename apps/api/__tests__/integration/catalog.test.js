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
  recordMovement,
  insertOrder,
} from '../helpers/database.js';

// The catalog served over HTTP, from PostgreSQL. The point of these tests is
// the CONTRACT: both frontends read `_id`, naira prices and `images[].url`, and
// none of that may change just because the storage did.

jest.setTimeout(30000);

let app;

beforeAll(async () => {
  await setupDatabase();
  // Point the service layer's lazily-created connection at this worker's
  // throwaway database before the app is imported.
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));
});

afterAll(async () => {
  // The app creates its own pool via getSequelize(); leaving it open holds the
  // process alive and would hang the CI job rather than failing it.
  await closeSequelize();
  await teardownDatabase();
});

const addImage = (itemId, url, position = 0) =>
  getDb().query(
    `INSERT INTO sellable_images (sellable_item_id, url, position) VALUES (:id, :url, :position)`,
    { replacements: { id: itemId, url, position } }
  );

describe('GET /api/products — the shape the storefront expects', () => {
  let productId;

  beforeAll(async () => {
    productId = await insertProduct({
      name: 'Milano Sofa',
      description: 'A deep three-seater',
      category: 'Sofas',
      style: 'Modern',
      price: 45000000, // ₦450,000
      cost_price: 20000000,
      sku: 'MIL-001',
    });
    await addImage(productId, 'https://cdn.example.com/milano.png');
    await recordMovement(productId, 7, 'purchase_receipt');
  });

  test('publishes _id, not id', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    const product = res.body.products.find((p) => p.name === 'Milano Sofa');
    expect(product._id).toBeTruthy();
    expect(product.id).toBeUndefined();
  });

  test('publishes prices in naira, not the kobo they are stored in', async () => {
    const res = await request(app).get('/api/products');
    const product = res.body.products.find((p) => p.name === 'Milano Sofa');

    expect(product.price).toBe(450000);
  });

  test('publishes images as objects with a url', async () => {
    const res = await request(app).get('/api/products');
    const product = res.body.products.find((p) => p.name === 'Milano Sofa');

    expect(product.images).toEqual([{ url: 'https://cdn.example.com/milano.png' }]);
  });

  test('keeps the pagination envelope', async () => {
    const res = await request(app).get('/api/products?page=1&limit=12');

    expect(res.body).toMatchObject({
      currentPage: 1,
      hasMore: expect.any(Boolean),
      totalProducts: expect.any(Number),
    });
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  test('never exposes a product with no images as null', async () => {
    const bare = await insertProduct({ name: 'No pictures' });
    const res = await request(app).get('/api/products?search=No pictures');

    expect(res.body.products[0]._id).toBe(bare);
    expect(res.body.products[0].images).toEqual([]);
  });

  test('reports stock as what is AVAILABLE, not what is on the floor', async () => {
    // Seven on hand, five committed to a confirmed order. Publishing seven
    // would promise stock the shop has already sold.
    const orderId = await insertOrder({ orderNumber: 'ORD-CAT-1' });
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity)
       VALUES ('${productId}', '${orderId}', 5)`
    );

    const res = await request(app).get('/api/products?search=Milano');
    expect(res.body.products[0].stockQuantity).toBe(2);
  });
});

describe('GET /api/products — filtering', () => {
  beforeAll(async () => {
    await insertProduct({ name: 'Oak Dining Table', category: 'Dining', style: 'Rustic', price: 30000000 });
    await insertProduct({ name: 'Velvet Armchair', category: 'Chairs', style: 'Modern', price: 8000000 });
    await insertProduct({
      name: 'Imported Chaise',
      category: 'Chairs',
      style: 'Antique/Royal',
      price: 60000000,
      is_foreign: true,
      origin: 'Italy',
      is_promo: true,
      discounted_price: 54000000,
    });
  });

  test('filters by category, and "all" means no filter', async () => {
    const chairs = await request(app).get('/api/products?category=Chairs');
    expect(chairs.body.products.every((p) => p.category === 'Chairs')).toBe(true);
    expect(chairs.body.products.length).toBeGreaterThanOrEqual(2);

    const all = await request(app).get('/api/products?category=all');
    expect(all.body.totalProducts).toBeGreaterThan(chairs.body.totalProducts);
  });

  test('searches name and description, case-insensitively', async () => {
    const res = await request(app).get('/api/products?search=OAK');
    expect(res.body.products.map((p) => p.name)).toContain('Oak Dining Table');

    const byDescription = await request(app).get('/api/products?search=three-seater');
    expect(byDescription.body.products.map((p) => p.name)).toContain('Milano Sofa');
  });

  test('filters by price range in naira', async () => {
    // The bound arrives in naira and is compared against kobo. Getting the
    // conversion wrong by 100x would silently return everything or nothing.
    const res = await request(app).get('/api/products?minPrice=100000&maxPrice=500000');

    expect(res.body.products.length).toBeGreaterThan(0);
    for (const product of res.body.products) {
      expect(product.price).toBeGreaterThanOrEqual(100000);
      expect(product.price).toBeLessThanOrEqual(500000);
    }
    expect(res.body.products.map((p) => p.name)).not.toContain('Velvet Armchair');
  });

  test('filters by style, tolerating the URL-encoded slash', async () => {
    // 'Antique/Royal' arrives as 'Antique%2FRoyal' from some callers.
    const plain = await request(app).get('/api/products?style=antique/royal');
    const encoded = await request(app).get('/api/products?style=antique%252Froyal');

    expect(plain.body.products.map((p) => p.name)).toContain('Imported Chaise');
    expect(encoded.body.products.map((p) => p.name)).toContain('Imported Chaise');
  });

  test('filters by promo and foreign flags', async () => {
    const promo = await request(app).get('/api/products?isPromo=true');
    expect(promo.body.products.every((p) => p.isPromo)).toBe(true);
    expect(promo.body.products[0].discountedPrice).toBe(540000);

    const foreign = await request(app).get('/api/products?isForeign=true');
    expect(foreign.body.products.every((p) => p.isForeign)).toBe(true);
    expect(foreign.body.products[0].origin).toBe('Italy');
  });

  test('counts against the filter, not the whole catalog', async () => {
    const res = await request(app).get('/api/products?category=Chairs&limit=1');

    expect(res.body.products).toHaveLength(1);
    expect(res.body.totalProducts).toBeGreaterThanOrEqual(2);
    expect(res.body.hasMore).toBe(true);
  });

  test('paginates without repeating a row across pages', async () => {
    // An unstable sort would silently show the same product twice and hide
    // another. The ordering is (created_at DESC, id) for that reason.
    const first = await request(app).get('/api/products?page=1&limit=2');
    const second = await request(app).get('/api/products?page=2&limit=2');

    const ids = [...first.body.products, ...second.body.products].map((p) => p._id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('GET /api/products/count', () => {
  test('counts the whole catalog, ignoring filters', async () => {
    const res = await request(app).get('/api/products/count');
    expect(res.status).toBe(200);
    expect(res.body.totalProducts).toBeGreaterThan(0);
  });
});

describe('GET /api/products/:id', () => {
  test('returns the product with its collection named', async () => {
    const collectionId = await insertCollection({ name: 'Milano Living Set' });
    const productId = await insertProduct({ name: 'Milano Ottoman' });
    await getDb().query(
      `INSERT INTO collection_products (collection_id, product_id) VALUES ('${collectionId}', '${productId}')`
    );

    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(productId);
    expect(res.body.collectionId).toEqual({ _id: collectionId, name: 'Milano Living Set' });
  });

  test('publishes only APPROVED reviews', async () => {
    // An unapproved review reaching the storefront would let anyone who can
    // post one publish whatever they wrote.
    const productId = await insertProduct({ name: 'Reviewed bench' });
    const approved = await insertCustomer({ full_name: 'Ada Approved' });
    const pending = await insertCustomer({ full_name: 'Ben Pending' });

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating, comment, is_approved, approved_at)
       VALUES ('${productId}', '${approved}', 5, 'Lovely', true, now())`
    );
    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating, comment)
       VALUES ('${productId}', '${pending}', 1, 'Not moderated yet')`
    );

    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].comment).toBe('Lovely');
    expect(res.body.reviews[0].userId.username).toBe('Ada Approved');
    expect(res.body.averageRating).toBe(5);
  });

  test('404s for a product that does not exist', async () => {
    const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Product not found.');
  });

  test('400s for a malformed id rather than 500ing', async () => {
    const res = await request(app).get('/api/products/not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid Product ID format.');
  });

  test('does not return a collection through the product route', async () => {
    const collectionId = await insertCollection({ name: 'Not a product' });
    const res = await request(app).get(`/api/products/${collectionId}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/products/by-ids', () => {
  test('preserves the order asked for', async () => {
    // The compare and recently-viewed features rely on this.
    const a = await insertProduct({ name: 'First' });
    const b = await insertProduct({ name: 'Second' });
    const c = await insertProduct({ name: 'Third' });

    const res = await request(app).get(`/api/products/by-ids?ids=${c},${a},${b}`);

    expect(res.body.products.map((p) => p._id)).toEqual([c, a, b]);
  });

  test('silently drops ids that no longer exist', async () => {
    const a = await insertProduct({ name: 'Still here' });
    const res = await request(app).get(
      `/api/products/by-ids?ids=${a},00000000-0000-0000-0000-000000000000`
    );

    expect(res.body.products.map((p) => p._id)).toEqual([a]);
  });

  test('returns an empty list for entirely malformed ids, not a 500', async () => {
    const res = await request(app).get('/api/products/by-ids?ids=nonsense,rubbish');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  test('400s when the parameter is missing', async () => {
    const res = await request(app).get('/api/products/by-ids');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('ids query param is required.');
  });
});

describe('Collections', () => {
  let collectionId;
  let memberId;

  beforeAll(async () => {
    collectionId = await insertCollection({ name: 'Executive Office', price: 120000000 });
    await getDb().query(
      `UPDATE collections SET cover_image_url = 'https://cdn.example.com/office.png',
                              cover_image_public_id = 'office_123'
       WHERE id = '${collectionId}'`
    );

    memberId = await insertProduct({ name: 'Executive Desk', price: 70000000 });
    await addImage(memberId, 'https://cdn.example.com/desk.png');
    await getDb().query(
      `INSERT INTO collection_products (collection_id, product_id, position)
       VALUES ('${collectionId}', '${memberId}', 0)`
    );
  });

  test('lists collections with the expected envelope', async () => {
    const res = await request(app).get('/api/collections');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currentPage: 1,
      totalPages: expect.any(Number),
      totalCollections: expect.any(Number),
      hasMore: expect.any(Boolean),
    });
  });

  test('counts collections', async () => {
    const res = await request(app).get('/api/collections/count');
    expect(res.body.totalCollections).toBeGreaterThan(0);
  });

  test('returns a collection with its members priced in naira', async () => {
    const res = await request(app).get(`/api/collections/${collectionId}`);

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(1200000);
    expect(res.body.coverImage).toEqual({
      url: 'https://cdn.example.com/office.png',
      public_id: 'office_123',
    });
    expect(res.body.productIds).toEqual([
      {
        _id: memberId,
        name: 'Executive Desk',
        description: 'A comfortable sofa',
        price: 700000,
        images: [{ url: 'https://cdn.example.com/desk.png' }],
      },
    ]);
  });

  test('404s for a missing collection and 400s for a malformed id', async () => {
    expect((await request(app).get('/api/collections/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await request(app).get('/api/collections/nope')).status).toBe(400);
  });

  test('does not return a product through the collection route', async () => {
    const productId = await insertProduct({ name: 'Not a collection' });
    expect((await request(app).get(`/api/collections/${productId}`)).status).toBe(404);
  });
});
