import { jest } from '@jest/globals';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  expectRejection,
  insertProduct,
  insertOrder,
  recordMovement,
  stockOf,
} from '../helpers/database.js';

// The audit's finding was that placing an order never decremented stock, so
// inventory became fiction the moment anyone bought anything. Fixing it with a
// counter would have replaced that with a number nobody can explain — "why does
// this say 4?" has no answer when the number is the only record. Stock is an
// append-only log; the balance is derived from it.

jest.setTimeout(30000);

beforeAll(async () => {
  await setupDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('History cannot be rewritten', () => {
  test('refuses to update a movement', async () => {
    const productId = await insertProduct();
    const movementId = await recordMovement(productId, 10, 'purchase_receipt');

    await expectRejection(
      `UPDATE stock_movements SET quantity = 999 WHERE id = '${movementId}'`,
      'append-only'
    );
  });

  test('refuses to delete a movement', async () => {
    const productId = await insertProduct();
    const movementId = await recordMovement(productId, 10, 'purchase_receipt');

    await expectRejection(
      `DELETE FROM stock_movements WHERE id = '${movementId}'`,
      'append-only'
    );
  });

  test('a mistake is corrected by a reversing movement, leaving both visible', async () => {
    const productId = await insertProduct();
    await recordMovement(productId, 100, 'purchase_receipt');       // meant 10
    await recordMovement(productId, -90, 'adjustment', { note: 'Miscount on GRN 4471' });

    expect((await stockOf(productId)).on_hand).toBe(10);

    const [rows] = await getDb().query(
      `SELECT quantity, reason, note FROM stock_movements
       WHERE product_id = '${productId}' ORDER BY occurred_at, quantity DESC`
    );
    // Both the error and the correction survive, which is what makes the
    // balance explainable to whoever asks later.
    expect(rows).toHaveLength(2);
    expect(rows[1].note).toMatch(/Miscount/);
  });
});

describe('Movements have to make sense', () => {
  test('rejects a zero-quantity movement', async () => {
    // A note is supplied so this reaches the quantity check rather than
    // tripping the adjustment-needs-a-note constraint first — which is exactly
    // what the constraint-name assertion in expectRejection caught.
    const productId = await insertProduct();
    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason, note)
       VALUES ('${productId}', 0, 'adjustment', 'Stock take, no change')`,
      'stock_movements_quantity_check'
    );
  });

  test('rejects an adjustment with no explanation', async () => {
    // A correction with no reason given is how a discrepancy becomes permanent.
    const productId = await insertProduct();

    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason)
       VALUES ('${productId}', -5, 'adjustment')`,
      'stock_adjustment_needs_a_note'
    );
    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason, note)
       VALUES ('${productId}', -5, 'adjustment', '   ')`,
      'stock_adjustment_needs_a_note'
    );
  });

  test('rejects a sale that names no order', async () => {
    const productId = await insertProduct();
    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason)
       VALUES ('${productId}', -1, 'sale')`,
      'stock_sale_names_its_order'
    );
  });

  test('rejects a receipt that removes stock', async () => {
    const productId = await insertProduct();
    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason)
       VALUES ('${productId}', -5, 'purchase_receipt')`,
      'stock_receipt_is_positive'
    );
  });

  test('rejects a sale that adds stock', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-INV-1' });
    await expectRejection(
      `INSERT INTO stock_movements (product_id, quantity, reason, order_id)
       VALUES ('${productId}', 5, 'sale', '${orderId}')`,
      'stock_issue_is_negative'
    );
  });

  test('refuses to delete a product that has stock history', async () => {
    // ON DELETE RESTRICT: losing the movements would leave an unexplainable
    // gap in what was bought and sold.
    const productId = await insertProduct();
    await recordMovement(productId, 5, 'purchase_receipt');

    await expectRejection(
      `DELETE FROM products WHERE id = '${productId}'`,
      'stock_movements_product_id_fkey'
    );
  });
});

describe('The balance follows the log', () => {
  test('a new product starts at zero, not at "no row"', async () => {
    const productId = await insertProduct();
    const stock = await stockOf(productId);

    expect(stock.on_hand).toBe(0);
    expect(stock.available).toBe(0);
  });

  test('accumulates receipts, sales and returns', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-INV-2' });

    await recordMovement(productId, 20, 'purchase_receipt');
    await recordMovement(productId, -3, 'sale', { orderId });
    await recordMovement(productId, 1, 'return', { orderId });
    await recordMovement(productId, -2, 'damage');

    expect((await stockOf(productId)).on_hand).toBe(16);
  });

  test('the cached balance always equals the sum of the log', async () => {
    // The reconciliation view exists precisely so this claim is checkable
    // rather than assumed. If it ever returns a row, something wrote the cache
    // directly.
    const a = await insertProduct({ name: 'A' });
    const b = await insertProduct({ name: 'B' });
    const orderId = await insertOrder({ orderNumber: 'ORD-INV-3' });

    for (let i = 0; i < 25; i += 1) {
      await recordMovement(a, 4, 'purchase_receipt');
      await recordMovement(b, -1, 'sale', { orderId });
    }

    const [discrepancies] = await getDb().query('SELECT * FROM product_stock_discrepancies');
    expect(discrepancies).toEqual([]);
    expect((await stockOf(a)).on_hand).toBe(100);
    expect((await stockOf(b)).on_hand).toBe(-25);
  });

  test('stock can go negative, and says so rather than hiding it', async () => {
    // Refusing to record an oversell would mean the log stops matching the
    // warehouse, which is worse than a negative number nobody can miss.
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-INV-4' });

    await recordMovement(productId, 1, 'purchase_receipt');
    await recordMovement(productId, -3, 'sale', { orderId });

    expect((await stockOf(productId)).on_hand).toBe(-2);
  });
});

describe('Reservations — what stops two customers buying the last sofa', () => {
  test('a held reservation reduces what is available without moving stock', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-1' });
    await recordMovement(productId, 5, 'purchase_receipt');

    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 2)`
    );

    const stock = await stockOf(productId);
    expect(stock.on_hand).toBe(5);   // still physically here
    expect(stock.reserved).toBe(2);
    expect(stock.available).toBe(3); // but not sellable
  });

  test('releasing a reservation returns the stock to available', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-2' });
    await recordMovement(productId, 5, 'purchase_receipt');
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 2)`
    );

    await getDb().query(
      `UPDATE stock_reservations SET status = 'released', resolved_at = now()
       WHERE order_id = '${orderId}'`
    );

    expect((await stockOf(productId)).available).toBe(5);
  });

  test('committing a reservation and shipping the goods leaves the sums right', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-3' });
    await recordMovement(productId, 5, 'purchase_receipt');
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 2)`
    );

    // Payment confirmed: the hold becomes a real movement.
    await getDb().query(
      `UPDATE stock_reservations SET status = 'committed', resolved_at = now() WHERE order_id = '${orderId}'`
    );
    await recordMovement(productId, -2, 'sale', { orderId });

    const stock = await stockOf(productId);
    expect(stock.on_hand).toBe(3);
    expect(stock.reserved).toBe(0);
    expect(stock.available).toBe(3);
  });

  test('rejects a second reservation for the same order and product', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-4' });
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 1)`
    );

    await expectRejection(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 1)`,
      'stock_reservations_order_id_product_id_key'
    );
  });

  test('rejects a resolved reservation with no resolution date', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-5' });
    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 1)`
    );

    await expectRejection(
      `UPDATE stock_reservations SET status = 'released' WHERE order_id = '${orderId}'`,
      'reservation_resolution_is_dated'
    );
  });

  test('rejects a zero-quantity hold', async () => {
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-RES-6' });

    await expectRejection(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 0)`,
      'stock_reservations_quantity_check'
    );
  });
});

describe('Low stock', () => {
  test('is measured against what is available, not what is on the floor', async () => {
    // Five on hand with four reserved is one sellable unit, not five. Reporting
    // it as healthy is how a shop promises stock it has already committed.
    const productId = await insertProduct();
    const orderId = await insertOrder({ orderNumber: 'ORD-LOW-1' });
    await getDb().query(`UPDATE products SET low_stock_threshold = 2 WHERE id = '${productId}'`);
    await recordMovement(productId, 5, 'purchase_receipt');

    expect((await stockOf(productId)).is_low).toBe(false);

    await getDb().query(
      `INSERT INTO stock_reservations (product_id, order_id, quantity) VALUES ('${productId}', '${orderId}', 4)`
    );

    const stock = await stockOf(productId);
    expect(stock.on_hand).toBe(5);
    expect(stock.available).toBe(1);
    expect(stock.is_low).toBe(true);
  });
});
