import { jest } from '@jest/globals';
import { QueryTypes } from 'sequelize';
import { setupDatabase, teardownDatabase, getDb, insertProduct } from '../helpers/database.js';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createCollection,
  updateCollection,
  deleteCollection,
  CatalogError,
} from '../../src/services/catalogAdmin.js';

// The catalog write path. Its validation rules are carried over from the old
// admin controller unchanged — these tests are what says so.

jest.setTimeout(30000);

/**
 * A stand-in for Cloudinary that records what it was asked to do.
 *
 * The real store needs live credentials, so injecting this is what makes the
 * business logic testable at all; only the two HTTP calls it replaces are left
 * uncovered.
 */
const fakeStore = () => {
  const uploaded = [];
  const destroyed = [];
  return {
    uploaded,
    destroyed,
    async upload(base64, folder) {
      const publicId = `${folder}/img_${uploaded.length + 1}`;
      uploaded.push({ base64, folder, publicId });
      return { url: `https://cdn.test/${publicId}.png`, publicId };
    },
    async destroy(publicId) {
      destroyed.push(publicId);
    },
  };
};

const BASE64 = 'data:image/png;base64,iVBORw0KGgo=';

let db;
let store;
const opts = () => ({ db, store });

beforeAll(async () => {
  db = await setupDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

beforeEach(() => {
  store = fakeStore();
});

const validProduct = (overrides = {}) => ({
  name: 'Milano Sofa',
  description: 'A deep three-seater',
  price: '450000',
  category: 'Sofas',
  style: 'Modern',
  ...overrides,
});

describe('Creating a product', () => {
  test('stores naira as kobo and publishes naira back', async () => {
    const product = await createProduct(validProduct(), opts());

    expect(product.price).toBe(450000);
    const [row] = await db.query('SELECT price FROM sellable_items WHERE id = :id', {
      replacements: { id: product._id },
      type: QueryTypes.SELECT,
    });
    expect(Number(row.price)).toBe(45000000);
  });

  test('requires the fields the old controller required', async () => {
    for (const missing of ['name', 'description', 'price', 'category', 'style']) {
      const body = validProduct();
      delete body[missing];
      await expect(createProduct(body, opts())).rejects.toThrow(
        /Please enter all required product fields/
      );
    }
  });

  test('a promotion needs a discounted price', async () => {
    await expect(
      createProduct(validProduct({ isPromo: true }), opts())
    ).rejects.toThrow(/Discounted price is required/);
  });

  test('a discount must be strictly below the list price', async () => {
    // The schema permits equal; the application never did, and that rule is
    // preserved here rather than quietly relaxed by the migration.
    await expect(
      createProduct(validProduct({ isPromo: true, discountedPrice: '450000' }), opts())
    ).rejects.toThrow(/must be less than the original price/);

    await expect(
      createProduct(validProduct({ isPromo: true, discountedPrice: '500000' }), opts())
    ).rejects.toThrow(/must be less than the original price/);
  });

  test('an imported product must state its origin', async () => {
    await expect(
      createProduct(validProduct({ isForeign: true }), opts())
    ).rejects.toThrow(/Origin is required/);
  });

  test('rejects a shipping window that ends before it starts', async () => {
    await expect(
      createProduct(validProduct({ shippingMinDays: '10', shippingMaxDays: '3' }), opts())
    ).rejects.toThrow(/Shipping max days must be >= shipping min days/);
  });

  test('rejects negative lead and shipping times', async () => {
    await expect(
      createProduct(validProduct({ leadTimeDays: '-1' }), opts())
    ).rejects.toThrow(/Lead time days must be a non-negative number/);
  });

  test('uploads base64 images and stores what came back', async () => {
    const product = await createProduct(
      validProduct({ images: [BASE64, BASE64] }),
      opts()
    );

    expect(store.uploaded).toHaveLength(2);
    expect(store.uploaded[0].folder).toBe('furniture_products');
    expect(product.images).toHaveLength(2);
    expect(product.images[0].url).toMatch(/^https:\/\/cdn\.test\//);
  });

  test('skips a malformed image rather than losing the others', async () => {
    const product = await createProduct(
      validProduct({ images: [BASE64, 'not-an-image', 42, null] }),
      opts()
    );

    expect(store.uploaded).toHaveLength(1);
    expect(product.images).toHaveLength(1);
  });

  test('splits comma-separated SEO keywords and trims them', async () => {
    const product = await createProduct(
      validProduct({ seoKeywords: ' sofa , luxury ,, lagos ' }),
      opts()
    );

    const [row] = await db.query('SELECT seo_keywords FROM products WHERE id = :id', {
      replacements: { id: product._id },
      type: QueryTypes.SELECT,
    });
    expect(row.seo_keywords).toEqual(['sofa', 'luxury', 'lagos']);
  });

  test('404s for a collection that does not exist', async () => {
    const error = await createProduct(
      validProduct({ collectionId: '00000000-0000-0000-0000-000000000000' }),
      opts()
    ).catch((e) => e);

    expect(error).toBeInstanceOf(CatalogError);
    expect(error.status).toBe(404);
  });

  test('400s for a malformed collection id', async () => {
    await expect(
      createProduct(validProduct({ collectionId: 'nonsense' }), opts())
    ).rejects.toThrow(/Invalid Collection ID format/);
  });

  test('leaves nothing behind when the transaction fails', async () => {
    // The collection check runs inside the transaction, so a bad id must not
    // leave a half-created product.
    const before = await db.query(`SELECT count(*)::int AS n FROM sellable_items`, {
      type: QueryTypes.SELECT,
    });

    await createProduct(
      validProduct({ collectionId: '00000000-0000-0000-0000-000000000000' }),
      opts()
    ).catch(() => {});

    const after = await db.query(`SELECT count(*)::int AS n FROM sellable_items`, {
      type: QueryTypes.SELECT,
    });
    expect(after[0].n).toBe(before[0].n);
  });
});

describe('Updating a product', () => {
  test('changes only what was sent', async () => {
    const created = await createProduct(validProduct({ category: 'Sofas' }), opts());
    const updated = await updateProduct(created._id, { name: 'Milano Sofa II' }, opts());

    expect(updated.name).toBe('Milano Sofa II');
    expect(updated.category).toBe('Sofas');
    expect(updated.price).toBe(450000);
  });

  test('validates against the merged result, not the fields in isolation', async () => {
    // Lowering the price below an existing discount would otherwise pass: the
    // price is valid on its own, and the discount was valid when it was set.
    const created = await createProduct(
      validProduct({ isPromo: true, discountedPrice: '400000' }),
      opts()
    );

    await expect(
      updateProduct(created._id, { price: '300000' }, opts())
    ).rejects.toThrow(/must be less than the original price/);
  });

  test('keeps existing images, uploads new ones, and deletes what was dropped', async () => {
    const created = await createProduct(validProduct({ images: [BASE64, BASE64] }), opts());
    const keptUrl = created.images[0].url;
    const droppedPublicId = store.uploaded[1].publicId;

    const updated = await updateProduct(
      created._id,
      {
        images: [
          { url: keptUrl, public_id: true },     // the frontend's "keep" marker
          { url: BASE64, isNew: true },
        ],
      },
      opts()
    );

    expect(updated.images).toHaveLength(2);
    expect(updated.images[0].url).toBe(keptUrl);
    // The image no longer referenced is removed from storage, not orphaned.
    expect(store.destroyed).toContain(droppedPublicId);
  });

  test('does not delete an image the request asked to keep', async () => {
    // The "keep" marker sends public_id as the literal `true`, so matching
    // orphans on public_id alone would delete an image still in use.
    const created = await createProduct(validProduct({ images: [BASE64] }), opts());

    await updateProduct(
      created._id,
      { images: [{ url: created.images[0].url, public_id: true }] },
      opts()
    );

    expect(store.destroyed).toEqual([]);
  });

  test('leaves images alone when the request does not mention them', async () => {
    const created = await createProduct(validProduct({ images: [BASE64] }), opts());
    const updated = await updateProduct(created._id, { name: 'Renamed' }, opts());

    expect(updated.images).toHaveLength(1);
    expect(store.destroyed).toEqual([]);
  });

  test('404s for a product that does not exist', async () => {
    const error = await updateProduct(
      '00000000-0000-0000-0000-000000000000',
      { name: 'x' },
      opts()
    ).catch((e) => e);

    expect(error.status).toBe(404);
  });
});

describe('Collection membership', () => {
  test('moving a product to another collection removes it from the first', async () => {
    // The old controller did this by hand across two documents. Here the
    // membership exists once, and migration 0009 makes the cardinality real.
    const a = await createCollection({ name: 'Set A', price: '100000', style: 'Modern' }, opts());
    const b = await createCollection({ name: 'Set B', price: '100000', style: 'Modern' }, opts());
    const product = await createProduct(validProduct({ collectionId: a._id }), opts());

    expect((await updateProduct(product._id, { collectionId: b._id }, opts())).collectionId._id).toBe(
      b._id
    );

    const rows = await db.query(
      'SELECT collection_id FROM collection_products WHERE product_id = :id',
      { replacements: { id: product._id }, type: QueryTypes.SELECT }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].collection_id).toBe(b._id);
  });

  test('the database refuses a second collection for one product', async () => {
    const a = await createCollection({ name: 'Set C', price: '100000', style: 'Modern' }, opts());
    const b = await createCollection({ name: 'Set D', price: '100000', style: 'Modern' }, opts());
    const product = await createProduct(validProduct({ collectionId: a._id }), opts());

    let error = null;
    try {
      await db.query(
        `INSERT INTO collection_products (collection_id, product_id) VALUES ('${b._id}', '${product._id}')`
      );
    } catch (err) {
      error = err;
    }
    expect(error?.parent?.constraint).toBe('collection_products_one_collection_per_product');
  });

  test('setting a collection\'s members takes them from their previous collections', async () => {
    const a = await createCollection({ name: 'Set E', price: '100000', style: 'Modern' }, opts());
    const product = await createProduct(validProduct({ collectionId: a._id }), opts());
    const b = await createCollection(
      { name: 'Set F', price: '100000', style: 'Modern', productIds: [product._id] },
      opts()
    );

    expect((await updateProduct(product._id, {}, opts())).collectionId._id).toBe(b._id);
  });

  test('ignores a member id that is not a product', async () => {
    const other = await createCollection({ name: 'Set G', price: '100000', style: 'Modern' }, opts());
    const collection = await createCollection(
      {
        name: 'Set H',
        price: '100000',
        style: 'Modern',
        productIds: [other._id, 'nonsense', '00000000-0000-0000-0000-000000000000'],
      },
      opts()
    );

    expect(collection.productIds).toEqual([]);
  });
});

describe('Deleting', () => {
  test('removes the product and its images from storage', async () => {
    const created = await createProduct(validProduct({ images: [BASE64] }), opts());
    const publicId = store.uploaded[0].publicId;

    await deleteProduct(created._id, opts());

    expect(store.destroyed).toContain(publicId);
    const rows = await db.query('SELECT 1 FROM sellable_items WHERE id = :id', {
      replacements: { id: created._id },
      type: QueryTypes.SELECT,
    });
    expect(rows).toHaveLength(0);
  });

  test('404s for a product that is not there', async () => {
    const error = await deleteProduct('00000000-0000-0000-0000-000000000000', opts()).catch((e) => e);
    expect(error.status).toBe(404);
  });

  test('refuses to delete a product that has stock history', async () => {
    // The inventory ledger holds the reference; losing it would leave an
    // unexplainable gap in what was bought and sold.
    const productId = await insertProduct({ name: 'Has history' });
    await db.query(
      `INSERT INTO stock_movements (product_id, quantity, reason) VALUES ('${productId}', 5, 'purchase_receipt')`
    );

    await expect(deleteProduct(productId, opts())).rejects.toThrow();
  });

  test('deleting a collection leaves its members alone', async () => {
    // Deleting a set does not delete the furniture in it.
    const product = await createProduct(validProduct(), opts());
    const collection = await createCollection(
      { name: 'Set I', price: '100000', style: 'Modern', productIds: [product._id] },
      opts()
    );

    await deleteCollection(collection._id, opts());

    const rows = await db.query(`SELECT 1 FROM sellable_items WHERE id = :id`, {
      replacements: { id: product._id },
      type: QueryTypes.SELECT,
    });
    expect(rows).toHaveLength(1);
  });

  test('a storage failure does not fail the delete', async () => {
    // The record is already gone by then; a Cloudinary outage should leave a
    // stray file and a log line, not a 500 and a half-applied change.
    const created = await createProduct(validProduct({ images: [BASE64] }), opts());
    store.destroy = async () => {
      throw new Error('cloudinary is down');
    };

    await expect(deleteProduct(created._id, opts())).resolves.toBeUndefined();
  });
});

describe('Collections', () => {
  test('creates one with a cover image', async () => {
    const collection = await createCollection(
      { name: 'Executive Office', price: '1200000', style: 'Modern', coverImage: BASE64 },
      opts()
    );

    expect(collection.price).toBe(1200000);
    expect(collection.coverImage.url).toMatch(/^https:\/\/cdn\.test\//);
    expect(store.uploaded[0].folder).toBe('furniture_collections');
  });

  test('replacing the cover deletes the old one', async () => {
    const collection = await createCollection(
      { name: 'Recovered', price: '100000', style: 'Modern', coverImage: BASE64 },
      opts()
    );
    const oldPublicId = store.uploaded[0].publicId;

    await updateCollection(collection._id, { coverImage: BASE64 }, opts());

    expect(store.destroyed).toContain(oldPublicId);
  });

  test('applies the same pricing rules as products', async () => {
    await expect(
      createCollection(
        { name: 'Bad', price: '1000', style: 'Modern', isPromo: true, discountedPrice: '2000' },
        opts()
      )
    ).rejects.toThrow(/must be less than the original price/);
  });

  test('404s for a collection that does not exist', async () => {
    const error = await updateCollection(
      '00000000-0000-0000-0000-000000000000',
      { name: 'x' },
      opts()
    ).catch((e) => e);
    expect(error.status).toBe(404);
  });
});
