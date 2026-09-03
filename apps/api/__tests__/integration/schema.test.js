import { jest } from '@jest/globals';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  expectRejection,
  insertProduct,
  insertCollection,
  insertCustomer,
} from '../helpers/database.js';

// Every test here asserts the database REJECTS something, or that it maintains
// a value itself. Asserting the good case passes would prove almost nothing —
// Mongo accepted the good case too. What it also accepted is the point.

jest.setTimeout(30000);

beforeAll(async () => {
  await setupDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Subtype integrity — what replaces refPath polymorphism', () => {
  test('a products row cannot attach to an item declared a collection', async () => {
    // The whole reason for the supertype. In Mongo, itemType was a string
    // nobody checked, so a cart line could claim a product id was a collection.
    const [[item]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price)
       VALUES ('collection', 'Not a product', 'Modern', 1000) RETURNING id`
    );

    await expectRejection(
      `INSERT INTO products (id, category) VALUES ('${item.id}', 'Sofas')`,
      'products_id_kind_fkey'
    );
  });

  test('a collections row cannot attach to an item declared a product', async () => {
    const [[item]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price)
       VALUES ('product', 'Not a collection', 'Modern', 1000) RETURNING id`
    );

    await expectRejection(
      `INSERT INTO collections (id) VALUES ('${item.id}')`,
      'collections_id_kind_fkey'
    );
  });

  test('a subtype row cannot relabel its own kind', async () => {
    const id = await insertProduct();

    await expectRejection(
      `UPDATE products SET kind = 'collection' WHERE id = '${id}'`,
      'products_kind_check'
    );
  });

  test('a review cannot point at a sellable item that does not exist', async () => {
    const customerId = await insertCustomer();

    await expectRejection(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating)
       VALUES ('00000000-0000-0000-0000-000000000000', '${customerId}', 5)`,
      'reviews_sellable_item_id_fkey'
    );
  });

  test('deleting a sellable item removes its subtype row', async () => {
    const id = await insertProduct();
    await getDb().query(`DELETE FROM sellable_items WHERE id = '${id}'`);

    const [rows] = await getDb().query(`SELECT 1 FROM products WHERE id = '${id}'`);
    expect(rows).toHaveLength(0);
  });
});

describe('Pricing constraints', () => {
  test('rejects a negative price', async () => {
    await expectRejection(
      `INSERT INTO sellable_items (kind, name, style, price)
       VALUES ('product', 'Free sofa', 'Modern', -1)`,
      'sellable_items_price_check'
    );
  });

  test('rejects a promotion with no promotional price', async () => {
    // Mongo expressed this as a conditional `required`, which only fires when
    // the write goes through the ODM.
    await expectRejection(
      `INSERT INTO sellable_items (kind, name, style, price, is_promo)
       VALUES ('product', 'Sofa', 'Modern', 1000, true)`,
      'sellable_promo_needs_price'
    );
  });

  test('rejects a discount above the list price', async () => {
    await expectRejection(
      `INSERT INTO sellable_items (kind, name, style, price, is_promo, discounted_price)
       VALUES ('product', 'Sofa', 'Modern', 1000, true, 1500)`,
      'sellable_discount_below_list'
    );
  });

  test('accepts a discount equal to the list price', async () => {
    const [[row]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price, is_promo, discounted_price)
       VALUES ('product', 'Sofa', 'Modern', 1000, true, 1000) RETURNING discounted_price`
    );
    expect(Number(row.discounted_price)).toBe(1000);
  });

  test('rejects an imported item with no stated origin', async () => {
    await expectRejection(
      `INSERT INTO sellable_items (kind, name, style, price, is_foreign)
       VALUES ('product', 'Sofa', 'Modern', 1000, true)`,
      'sellable_foreign_needs_origin'
    );
  });

  test('rejects a negative cost price', async () => {
    await expectRejection(
      `INSERT INTO sellable_items (kind, name, style, price, cost_price)
       VALUES ('product', 'Sofa', 'Modern', 1000, -5)`,
      'sellable_items_cost_price_check'
    );
  });
});

describe('Money is exact', () => {
  test('stores large kobo amounts without floating-point drift', async () => {
    // ₦12,345,678.90 — the value that a float64 naira column rounds.
    const kobo = 1234567890;
    const id = await insertProduct({ price: kobo, cost_price: 999999999 });

    const [[row]] = await getDb().query(
      `SELECT price, cost_price FROM sellable_items WHERE id = '${id}'`
    );

    expect(Number(row.price)).toBe(kobo);
    expect(Number(row.cost_price)).toBe(999999999);
  });

  test('a fractional input is ROUNDED by the cast, not rejected — so the guard lives in code', async () => {
    // Worth pinning because it is the one thing money_minor cannot do. The cast
    // to bigint happens before any CHECK constraint is evaluated, so Postgres
    // rounds half away from zero and says nothing. 100.33 -> 100, 100.5 -> 101.
    //
    // This is why src/lib/money.js exists: rounding has to be a deliberate act
    // in application code, because the database will not refuse it here.
    const [[low]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price)
       VALUES ('product', 'Rounds down', 'Modern', 100.33) RETURNING price`
    );
    const [[high]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price)
       VALUES ('product', 'Rounds up', 'Modern', 100.5) RETURNING price`
    );

    expect(Number(low.price)).toBe(100);
    expect(Number(high.price)).toBe(101);
  });

  test('sums stay exact across many rows', async () => {
    await getDb().query('DELETE FROM sellable_items');
    for (let i = 0; i < 100; i += 1) {
      await insertProduct({ price: 1, name: `Item ${i}` });
    }

    const [[row]] = await getDb().query('SELECT SUM(price) AS total FROM sellable_items');
    expect(Number(row.total)).toBe(100);
  });
});

describe('Reviews and the rating the database maintains', () => {
  test('rejects a rating outside 1–5', async () => {
    const itemId = await insertProduct();
    const customerId = await insertCustomer();

    await expectRejection(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating)
       VALUES ('${itemId}', '${customerId}', 6)`,
      'reviews_rating_check'
    );
    await expectRejection(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating)
       VALUES ('${itemId}', '${customerId}', 0)`,
      'reviews_rating_check'
    );
  });

  test('rejects a second review of the same item by the same customer', async () => {
    const itemId = await insertProduct();
    const customerId = await insertCustomer();

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating) VALUES ('${itemId}', '${customerId}', 5)`
    );

    await expectRejection(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating)
       VALUES ('${itemId}', '${customerId}', 1)`,
      'reviews_sellable_item_id_customer_id_key'
    );
  });

  test('rejects an approval with no approval timestamp', async () => {
    const itemId = await insertProduct();
    const customerId = await insertCustomer();

    await expectRejection(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating, is_approved)
       VALUES ('${itemId}', '${customerId}', 5, true)`,
      'reviews_approval_is_attributed'
    );
  });

  test('ignores unapproved reviews when computing the rating', async () => {
    // A rating built from unmoderated reviews would let anyone who can post one
    // move the number that appears in search results.
    const itemId = await insertProduct();
    const customerId = await insertCustomer();

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating) VALUES ('${itemId}', '${customerId}', 1)`
    );

    const [[row]] = await getDb().query(
      `SELECT average_rating, review_count FROM sellable_items WHERE id = '${itemId}'`
    );
    expect(Number(row.average_rating)).toBe(0);
    expect(row.review_count).toBe(0);
  });

  test('recomputes the rating when a review is approved', async () => {
    const itemId = await insertProduct();
    const a = await insertCustomer();
    const b = await insertCustomer();

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating, is_approved, approved_at)
       VALUES ('${itemId}', '${a}', 5, true, now()), ('${itemId}', '${b}', 4, true, now())`
    );

    const [[row]] = await getDb().query(
      `SELECT average_rating, review_count FROM sellable_items WHERE id = '${itemId}'`
    );
    expect(Number(row.average_rating)).toBe(4.5);
    expect(row.review_count).toBe(2);
  });

  test('recomputes the rating when a review is withdrawn', async () => {
    const itemId = await insertProduct();
    const a = await insertCustomer();
    const b = await insertCustomer();

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating, is_approved, approved_at)
       VALUES ('${itemId}', '${a}', 5, true, now()), ('${itemId}', '${b}', 1, true, now())`
    );
    await getDb().query(`DELETE FROM reviews WHERE sellable_item_id = '${itemId}' AND customer_id = '${b}'`);

    const [[row]] = await getDb().query(
      `SELECT average_rating, review_count FROM sellable_items WHERE id = '${itemId}'`
    );
    expect(Number(row.average_rating)).toBe(5);
    expect(row.review_count).toBe(1);
  });

  test('maintains the rating for a bulk approval, not just a single-row update', async () => {
    // The Mongo pre('save') hook fired per document; a moderation endpoint doing
    // updateMany bypassed it entirely and left the rating stale.
    const itemId = await insertProduct();
    const a = await insertCustomer();
    const b = await insertCustomer();

    await getDb().query(
      `INSERT INTO reviews (sellable_item_id, customer_id, rating) VALUES ('${itemId}', '${a}', 4), ('${itemId}', '${b}', 2)`
    );
    await getDb().query(
      `UPDATE reviews SET is_approved = true, approved_at = now() WHERE sellable_item_id = '${itemId}'`
    );

    const [[row]] = await getDb().query(
      `SELECT average_rating, review_count FROM sellable_items WHERE id = '${itemId}'`
    );
    expect(Number(row.average_rating)).toBe(3);
    expect(row.review_count).toBe(2);
  });
});

describe('Identity', () => {
  test('rejects an account with no way to authenticate', async () => {
    await expectRejection(
      `INSERT INTO customers (email, full_name) VALUES ('nobody@example.com', 'Nobody')`,
      'customers_has_credential'
    );
  });

  test('accepts a Supabase identity with no local password', async () => {
    const [[row]] = await getDb().query(
      `INSERT INTO customers (email, full_name, supabase_user_id)
       VALUES ('supa@example.com', 'Ada', gen_random_uuid()) RETURNING id`
    );
    expect(row.id).toBeTruthy();
  });

  test('treats email as case-insensitive for uniqueness', async () => {
    // Mongo's unique index is case-sensitive, so Ada@ and ada@ were two accounts
    // — and "email already in use" depended on how the user typed it.
    await insertCustomer({ email: 'Ada@Example.com' });

    await expectRejection(
      `INSERT INTO customers (email, full_name, password_hash)
       VALUES ('ada@example.com', 'Impostor', 'x')`,
      'customers_email_key'
    );
  });

  test('rejects negative loyalty points', async () => {
    await expectRejection(
      `INSERT INTO customers (email, full_name, password_hash, loyalty_points)
       VALUES ('neg@example.com', 'Ada', 'x', -1)`,
      'customers_loyalty_points_check'
    );
  });

  test('rejects an unknown staff role', async () => {
    await expectRejection(
      `INSERT INTO staff (username, email, password_hash, role)
       VALUES ('u', 'u@example.com', 'x', 'owner')`,
      'invalid input value for enum staff_role'
    );
  });
});

describe('Inventory and SKU', () => {
  test('stock is not a column here — it is derived from the movement log', async () => {
    // Deliberately absent. A mutable counter alongside an append-only log is a
    // second source of truth that can disagree with it; see inventory.test.js.
    const [rows] = await getDb().query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'products' AND column_name = 'stock_quantity'`
    );
    expect(rows).toHaveLength(0);
  });

  test('rejects a duplicate SKU', async () => {
    await insertProduct({ sku: 'MIL-001', name: 'A' });
    let error = null;
    try {
      await insertProduct({ sku: 'MIL-001', name: 'B' });
    } catch (err) {
      error = err;
    }
    expect(error?.parent?.constraint).toBe('products_sku_key');
  });

  test('allows many products with no SKU', async () => {
    // Unique but nullable: not every piece of furniture carries one, and Postgres
    // does not treat NULLs as equal.
    await insertProduct({ name: 'X' });
    await insertProduct({ name: 'Y' });

    const [[row]] = await getDb().query(
      'SELECT COUNT(*)::int AS n FROM products WHERE sku IS NULL'
    );
    expect(row.n).toBeGreaterThanOrEqual(2);
  });

  test('rejects a shipping window that ends before it starts', async () => {
    const id = await insertProduct();
    await expectRejection(
      `UPDATE products SET shipping_min_days = 10, shipping_max_days = 3 WHERE id = '${id}'`,
      'products_shipping_window_ordered'
    );
  });
});

describe('Collection membership', () => {
  test('rejects a member product that does not exist', async () => {
    const collectionId = await insertCollection();

    await expectRejection(
      `INSERT INTO collection_products (collection_id, product_id)
       VALUES ('${collectionId}', '00000000-0000-0000-0000-000000000000')`,
      'collection_products_product_id_fkey'
    );
  });

  test('a collection cannot contain another collection', async () => {
    const outer = await insertCollection({ name: 'Outer' });
    const inner = await insertCollection({ name: 'Inner' });

    // productIds was an array of raw ObjectIds, so nothing stopped a collection
    // id being dropped into it.
    await expectRejection(
      `INSERT INTO collection_products (collection_id, product_id) VALUES ('${outer}', '${inner}')`,
      'collection_products_product_id_fkey'
    );
  });

  test('removing a product removes it from every collection', async () => {
    const collectionId = await insertCollection({ name: 'Set' });
    const productId = await insertProduct({ name: 'Chair' });
    await getDb().query(
      `INSERT INTO collection_products (collection_id, product_id) VALUES ('${collectionId}', '${productId}')`
    );

    await getDb().query(`DELETE FROM sellable_items WHERE id = '${productId}'`);

    const [rows] = await getDb().query(
      `SELECT 1 FROM collection_products WHERE collection_id = '${collectionId}'`
    );
    expect(rows).toHaveLength(0);
  });
});

describe('Images', () => {
  test('rejects two images in the same position on one item', async () => {
    const id = await insertProduct();
    await getDb().query(
      `INSERT INTO sellable_images (sellable_item_id, url, position) VALUES ('${id}', 'a.png', 0)`
    );

    await expectRejection(
      `INSERT INTO sellable_images (sellable_item_id, url, position) VALUES ('${id}', 'b.png', 0)`,
      'sellable_images_sellable_item_id_position_key'
    );
  });
});

describe('Timestamps', () => {
  test('updated_at is maintained by the database, not the application', async () => {
    const id = await insertProduct();
    const [[before]] = await getDb().query(
      `SELECT updated_at FROM sellable_items WHERE id = '${id}'`
    );

    // A raw SQL update — no ORM hook involved, which is exactly the path a
    // manual fix or a bulk script takes.
    await getDb().query(`UPDATE sellable_items SET name = 'Renamed' WHERE id = '${id}'`);

    const [[after]] = await getDb().query(
      `SELECT updated_at FROM sellable_items WHERE id = '${id}'`
    );
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime()
    );
  });
});
