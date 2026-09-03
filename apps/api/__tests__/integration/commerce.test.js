import { jest } from '@jest/globals';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  expectRejection,
  insertProduct,
  insertCustomer,
  insertGuestSession,
  insertOrder,
} from '../helpers/database.js';

jest.setTimeout(30000);

beforeAll(async () => {
  await setupDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('Order arithmetic is enforced by the database', () => {
  test('rejects a total that is not the sum of its parts', async () => {
    // The audit found shipping and tax were read straight off the request body
    // and folded into the total with no validation. Even with that fixed in the
    // controller, the constraint means a future bug produces a failed insert
    // rather than an invoice nobody can reconcile.
    const customerId = await insertCustomer();

    await expectRejection(
      `INSERT INTO orders (order_number, customer_id, shipping_address, subtotal, discount, shipping_cost, tax_amount, total_amount)
       VALUES ('ORD-1', '${customerId}', '{}', 100000, 0, 5000, 7500, 999999)`,
      'orders_total_is_the_sum_of_its_parts'
    );
  });

  test('accepts a total that reconciles exactly', async () => {
    const id = await insertOrder({ subtotal: 100000, shipping: 5000, tax: 7500 });
    const [[row]] = await getDb().query(`SELECT total_amount FROM orders WHERE id = '${id}'`);
    expect(Number(row.total_amount)).toBe(112500);
  });

  test('rejects a discount larger than the goods', async () => {
    // A discount above the subtotal is a refund and belongs in a credit note.
    const customerId = await insertCustomer();

    await expectRejection(
      `INSERT INTO orders (order_number, customer_id, shipping_address, subtotal, discount, total_amount)
       VALUES ('ORD-2', '${customerId}', '{}', 1000, 5000, -4000)`,
      'orders_discount_within_subtotal'
    );
  });

  test('rejects an order with no buyer at all', async () => {
    await expectRejection(
      `INSERT INTO orders (order_number, shipping_address, subtotal, total_amount)
       VALUES ('ORD-3', '{}', 1000, 1000)`,
      'orders_has_a_buyer'
    );
  });

  test('rejects a second order reusing an idempotency key', async () => {
    // A double-submitted checkout produced two orders before this existed.
    const customerId = await insertCustomer();
    await insertOrder({ customerId, orderNumber: 'ORD-IDEM-1', idempotencyKey: 'checkout-abc' });

    await expectRejection(
      `INSERT INTO orders (order_number, customer_id, shipping_address, subtotal, total_amount, idempotency_key)
       VALUES ('ORD-IDEM-2', '${customerId}', '{}', 1000, 1000, 'checkout-abc')`,
      'orders_idempotency_key_key'
    );
  });

  test('allows many orders with no idempotency key', async () => {
    const customerId = await insertCustomer();
    await insertOrder({ customerId, orderNumber: 'ORD-N1' });
    await insertOrder({ customerId, orderNumber: 'ORD-N2' });

    const [[row]] = await getDb().query(
      `SELECT count(*)::int AS n FROM orders WHERE customer_id = '${customerId}'`
    );
    expect(row.n).toBe(2);
  });

  test('rejects a line total that is not price times quantity', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-LINE' });

    await expectRejection(
      `INSERT INTO order_items (order_id, name, unit_price, quantity, line_total)
       VALUES ('${orderId}', 'Sofa', 45000, 3, 45000)`,
      'order_items_line_total_is_price_times_quantity'
    );
  });

  test('keeps an order line after its product is retired', async () => {
    // An order must stay printable when a product is deleted from the catalog.
    const productId = await insertProduct({ name: 'Discontinued' });
    const orderId = await insertOrder({ orderNumber: 'ORD-KEEP' });
    await getDb().query(
      `INSERT INTO order_items (order_id, sellable_item_id, name, unit_price, quantity, line_total)
       VALUES ('${orderId}', '${productId}', 'Discontinued', 1000, 2, 2000)`
    );

    await getDb().query(`DELETE FROM sellable_items WHERE id = '${productId}'`);

    const [[row]] = await getDb().query(
      `SELECT name, unit_price, sellable_item_id FROM order_items WHERE order_id = '${orderId}'`
    );
    expect(row.name).toBe('Discontinued');
    expect(Number(row.unit_price)).toBe(1000);
    expect(row.sellable_item_id).toBeNull();
  });

  test('records a status change without an application hook', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-STATUS' });
    // A bulk update, which is exactly what bypassed the Mongoose pre('save').
    await getDb().query(`UPDATE orders SET status = 'processing' WHERE id = '${orderId}'`);

    const [rows] = await getDb().query(
      `SELECT status FROM order_status_events WHERE order_id = '${orderId}' ORDER BY created_at`
    );
    expect(rows.map((r) => r.status)).toEqual(['pending', 'processing']);
  });

  test('does not record an event when the status did not change', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-NOOP' });
    await getDb().query(`UPDATE orders SET notes = 'touched' WHERE id = '${orderId}'`);
    await getDb().query(`UPDATE orders SET status = 'pending' WHERE id = '${orderId}'`);

    const [rows] = await getDb().query(
      `SELECT 1 FROM order_status_events WHERE order_id = '${orderId}'`
    );
    expect(rows).toHaveLength(1);
  });

  test('rejects marking an order delivered with no delivery date', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-DEL' });
    await expectRejection(
      `UPDATE orders SET status = 'delivered' WHERE id = '${orderId}'`,
      'orders_delivered_has_date'
    );
  });
});

describe('Carts', () => {
  test('rejects a cart owned by both a customer and a guest', async () => {
    const customerId = await insertCustomer();
    const guestId = await insertGuestSession();

    await expectRejection(
      `INSERT INTO carts (customer_id, guest_session_id) VALUES ('${customerId}', '${guestId}')`,
      'carts_exactly_one_owner'
    );
  });

  test('rejects a cart owned by nobody', async () => {
    await expectRejection('INSERT INTO carts DEFAULT VALUES', 'carts_exactly_one_owner');
  });

  test('rejects a second cart for the same customer', async () => {
    const customerId = await insertCustomer();
    await getDb().query(`INSERT INTO carts (customer_id) VALUES ('${customerId}')`);

    await expectRejection(
      `INSERT INTO carts (customer_id) VALUES ('${customerId}')`,
      'carts_customer_id_key'
    );
  });

  test('rejects a duplicate line instead of allowing two rows for one item', async () => {
    // The embedded array allowed the same product twice, so the real quantity
    // was whatever you got after summing the lines.
    const customerId = await insertCustomer();
    const productId = await insertProduct();
    const [[cart]] = await getDb().query(
      `INSERT INTO carts (customer_id) VALUES ('${customerId}') RETURNING id`
    );
    await getDb().query(
      `INSERT INTO cart_items (cart_id, sellable_item_id, quantity) VALUES ('${cart.id}', '${productId}', 1)`
    );

    await expectRejection(
      `INSERT INTO cart_items (cart_id, sellable_item_id, quantity) VALUES ('${cart.id}', '${productId}', 2)`,
      'cart_items_pkey'
    );
  });

  test('rejects a zero or negative quantity', async () => {
    const customerId = await insertCustomer();
    const productId = await insertProduct();
    const [[cart]] = await getDb().query(
      `INSERT INTO carts (customer_id) VALUES ('${customerId}') RETURNING id`
    );

    await expectRejection(
      `INSERT INTO cart_items (cart_id, sellable_item_id, quantity) VALUES ('${cart.id}', '${productId}', 0)`,
      'cart_items_quantity_check'
    );
  });

  test('rejects a line pointing at an item that does not exist', async () => {
    const customerId = await insertCustomer();
    const [[cart]] = await getDb().query(
      `INSERT INTO carts (customer_id) VALUES ('${customerId}') RETURNING id`
    );

    await expectRejection(
      `INSERT INTO cart_items (cart_id, sellable_item_id, quantity)
       VALUES ('${cart.id}', '00000000-0000-0000-0000-000000000000', 1)`,
      'cart_items_sellable_item_id_fkey'
    );
  });

  test('a cart may hold a collection as well as a product', async () => {
    // Both are sellable_items, so this needs no second code path.
    const customerId = await insertCustomer();
    const productId = await insertProduct();
    const [[collection]] = await getDb().query(
      `INSERT INTO sellable_items (kind, name, style, price) VALUES ('collection', 'Set', 'Modern', 5000) RETURNING id`
    );
    await getDb().query(`INSERT INTO collections (id) VALUES ('${collection.id}')`);
    const [[cart]] = await getDb().query(
      `INSERT INTO carts (customer_id) VALUES ('${customerId}') RETURNING id`
    );

    await getDb().query(
      `INSERT INTO cart_items (cart_id, sellable_item_id, quantity)
       VALUES ('${cart.id}', '${productId}', 1), ('${cart.id}', '${collection.id}', 1)`
    );

    const [[row]] = await getDb().query(
      `SELECT count(*)::int AS n FROM cart_items WHERE cart_id = '${cart.id}'`
    );
    expect(row.n).toBe(2);
  });
});

describe('Wishlists', () => {
  test('rejects the same item twice for one customer', async () => {
    const customerId = await insertCustomer();
    const productId = await insertProduct();
    await getDb().query(
      `INSERT INTO wishlist_items (customer_id, sellable_item_id) VALUES ('${customerId}', '${productId}')`
    );

    await expectRejection(
      `INSERT INTO wishlist_items (customer_id, sellable_item_id) VALUES ('${customerId}', '${productId}')`,
      'wishlist_customer_item_idx'
    );
  });

  test('two different customers may wish for the same item', async () => {
    const a = await insertCustomer();
    const b = await insertCustomer();
    const productId = await insertProduct();

    await getDb().query(
      `INSERT INTO wishlist_items (customer_id, sellable_item_id)
       VALUES ('${a}', '${productId}'), ('${b}', '${productId}')`
    );

    const [[row]] = await getDb().query(
      `SELECT count(*)::int AS n FROM wishlist_items WHERE sellable_item_id = '${productId}'`
    );
    expect(row.n).toBe(2);
  });
});

describe('Coupons', () => {
  test('rejects a percentage discount above 100%', async () => {
    await expectRejection(
      `INSERT INTO coupons (code, discount_type, discount_value)
       VALUES ('HALF', 'percentage', 15000)`,
      'coupons_percentage_within_range'
    );
  });

  test('rejects usage beyond the stated limit', async () => {
    // The check and the increment were two separate Mongo operations, so a
    // concurrent redemption could push usage past the limit.
    await getDb().query(
      `INSERT INTO coupons (code, discount_type, discount_value, usage_limit, times_used)
       VALUES ('LIMITED', 'fixed', 5000, 2, 2)`
    );

    await expectRejection(
      `UPDATE coupons SET times_used = 3 WHERE code = 'LIMITED'`,
      'coupons_within_usage_limit'
    );
  });

  test('rejects a validity window that ends before it starts', async () => {
    await expectRejection(
      `INSERT INTO coupons (code, discount_type, discount_value, starts_at, expires_at)
       VALUES ('BACKWARDS', 'fixed', 100, '2026-06-01', '2026-01-01')`,
      'coupons_window_ordered'
    );
  });

  test('rejects a duplicate code', async () => {
    await getDb().query(
      `INSERT INTO coupons (code, discount_type, discount_value) VALUES ('UNIQUE1', 'fixed', 100)`
    );
    await expectRejection(
      `INSERT INTO coupons (code, discount_type, discount_value) VALUES ('UNIQUE1', 'fixed', 200)`,
      'coupons_code_key'
    );
  });
});

describe('Payments', () => {
  test('rejects a successful payment that was never verified', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-1' });

    await expectRejection(
      `INSERT INTO payment_transactions (order_id, amount, payment_method, status)
       VALUES ('${orderId}', 1000, 'paystack', 'success')`,
      'payment_success_is_verified'
    );
  });

  test('rejects a second transaction reusing a gateway reference', async () => {
    // What makes a replayed webhook safe at the storage layer, not just in the
    // handler's conditional update.
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-2' });
    await getDb().query(
      `INSERT INTO payment_transactions (order_id, amount, payment_method, gateway_reference)
       VALUES ('${orderId}', 1000, 'paystack', 'EM-REF-1')`
    );

    await expectRejection(
      `INSERT INTO payment_transactions (order_id, amount, payment_method, gateway_reference)
       VALUES ('${orderId}', 1000, 'paystack', 'EM-REF-1')`,
      'payment_transactions_gateway_reference_key'
    );
  });

  test('rejects a refund larger than the payment', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-3' });
    await getDb().query(
      `INSERT INTO payment_transactions (order_id, amount, payment_method, refunded_amount)
       VALUES ('${orderId}', 1000, 'paystack', 0)`
    );

    await expectRejection(
      `UPDATE payment_transactions SET refunded_amount = 5000 WHERE order_id = '${orderId}'`,
      'payment_refund_within_amount'
    );
  });

  test('rejects a zero-amount charge', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-4' });
    await expectRejection(
      `INSERT INTO payment_transactions (order_id, amount, payment_method)
       VALUES ('${orderId}', 0, 'paystack')`,
      'payment_transactions_amount_check'
    );
  });
});
