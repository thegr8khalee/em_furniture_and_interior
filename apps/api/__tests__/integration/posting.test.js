import { jest } from '@jest/globals';
import { QueryTypes } from 'sequelize';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  insertProduct,
  insertOrder,
  recordMovement,
} from '../helpers/database.js';
import { trialBalance } from '../../src/services/ledger.js';
import {
  postOrderConfirmed,
  postPaymentReceived,
  postStockMovement,
} from '../../src/services/posting.js';

// Where a business event becomes a journal entry. The properties that matter:
// each rule balances, each is idempotent under retry, and nothing is invented
// when a figure is genuinely unknown.

jest.setTimeout(30000);

const IN_PERIOD = '2026-09-15';

beforeAll(async () => {
  await setupDatabase();
  // A wide period so a row's created_at date always falls inside one.
  await getDb().query(
    `INSERT INTO accounting_periods (name, starts_on, ends_on)
     VALUES ('open-window', '2020-01-01', '2035-12-31')`
  );
});

afterAll(async () => {
  await teardownDatabase();
});

const linesOf = async (source, sourceId) =>
  getDb().query(
    `SELECT a.code, l.debit::bigint AS debit, l.credit::bigint AS credit
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     JOIN accounts a ON a.id = l.account_id
     WHERE e.source = :source AND e.source_id = :sourceId
     ORDER BY a.code`,
    { replacements: { source, sourceId }, type: QueryTypes.SELECT }
  );

const payFor = async (orderId, { amount, method = 'paystack', status = 'success' }) => {
  const [[row]] = await getDb().query(
    `INSERT INTO payment_transactions (order_id, amount, payment_method, status, verified_at, gateway_reference)
     VALUES (:orderId, :amount, :method, :status, ${status === 'success' ? 'now()' : 'NULL'}, :ref)
     RETURNING id`,
    {
      replacements: {
        orderId,
        amount,
        method,
        status,
        ref: `REF-${Math.random().toString(36).slice(2)}`,
      },
    }
  );
  return row.id;
};

describe('An order becomes revenue when it is confirmed', () => {
  test('debits receivable and credits revenue, delivery and VAT', async () => {
    const orderId = await insertOrder({
      orderNumber: 'ORD-POST-1',
      subtotal: 100000,
      shipping: 5000,
      tax: 7500,
    });

    const result = await postOrderConfirmed(getDb(), orderId);
    expect(result.posted).toBe(true);

    // The customer owes us from confirmation, so the debit is receivable, not
    // cash. Recognising on payment would leave a confirmed unpaid order
    // invisible in every report.
    expect(await linesOf('sales_order', orderId)).toEqual([
      { code: '1200', debit: '112500', credit: '0' },
      { code: '2200', debit: '0', credit: '7500' },
      { code: '4100', debit: '0', credit: '100000' },
      { code: '4300', debit: '0', credit: '5000' },
    ]);
  });

  test('a discount posts as contra-revenue rather than shrinking the sale', async () => {
    // Netting the discount off revenue would hide what was given away. The
    // debit to 4900 keeps both the gross sale and the discount visible.
    const orderId = await insertOrder({
      orderNumber: 'ORD-POST-2',
      subtotal: 100000,
      discount: 15000,
    });

    await postOrderConfirmed(getDb(), orderId);

    expect(await linesOf('sales_order', orderId)).toEqual([
      { code: '1200', debit: '85000', credit: '0' },
      { code: '4100', debit: '0', credit: '100000' },
      { code: '4900', debit: '15000', credit: '0' },
    ]);
  });

  test('omits lines that would be zero', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-POST-3', subtotal: 50000 });
    await postOrderConfirmed(getDb(), orderId);

    const codes = (await linesOf('sales_order', orderId)).map((l) => l.code);
    expect(codes).toEqual(['1200', '4100']);
  });

  test('posting the same order twice is a no-op, not a double-count', async () => {
    // A retried webhook or a re-run job must not overstate revenue.
    const orderId = await insertOrder({ orderNumber: 'ORD-POST-4', subtotal: 20000 });

    const first = await postOrderConfirmed(getDb(), orderId);
    const second = await postOrderConfirmed(getDb(), orderId);

    expect(first.posted).toBe(true);
    expect(second).toEqual({ posted: false, reason: 'already_posted' });

    const [[row]] = await getDb().query(
      `SELECT count(*)::int AS n FROM journal_entries
       WHERE source = 'sales_order' AND source_id = '${orderId}'`
    );
    expect(row.n).toBe(1);
  });

  test('the database refuses a duplicate even when the service is bypassed', async () => {
    // The service check is check-then-insert, which is not atomic: two webhook
    // deliveries arriving together would both find nothing. The unique index is
    // what actually holds.
    const orderId = await insertOrder({ orderNumber: 'ORD-POST-5', subtotal: 1000 });
    await postOrderConfirmed(getDb(), orderId);

    let error = null;
    try {
      await getDb().query(
        `INSERT INTO journal_entries (entry_number, entry_date, description, source, source_id)
         VALUES ('JE-DUP-1', '${IN_PERIOD}', 'duplicate', 'sales_order', '${orderId}')`
      );
    } catch (err) {
      error = err;
    }
    expect(error?.parent?.constraint).toBe('journal_entries_one_per_source');
  });

  test('refuses an order that does not exist', async () => {
    await expect(
      postOrderConfirmed(getDb(), '00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(/No order/);
  });
});

describe('A payment clears the receivable', () => {
  test('debits the settlement account and credits receivable', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-A', subtotal: 60000 });
    await postOrderConfirmed(getDb(), orderId);
    const paymentId = await payFor(orderId, { amount: 60000 });

    const result = await postPaymentReceived(getDb(), paymentId);
    expect(result.posted).toBe(true);

    // No revenue here — that happened at confirmation. This only moves the
    // balance from "owed" to "banked".
    expect(await linesOf('payment', paymentId)).toEqual([
      { code: '1110', debit: '60000', credit: '0' },
      { code: '1200', debit: '0', credit: '60000' },
    ]);
  });

  test('cash on delivery lands in the cash box, not the Paystack account', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-B', subtotal: 30000 });
    const paymentId = await payFor(orderId, { amount: 30000, method: 'cash_on_delivery' });

    await postPaymentReceived(getDb(), paymentId);

    const codes = (await linesOf('payment', paymentId)).map((l) => l.code);
    expect(codes).toContain('1130');
    expect(codes).not.toContain('1110');
  });

  test('does not post a charge that has not succeeded', async () => {
    // A pending charge has moved no money. Posting it would put cash on the
    // balance sheet that does not exist.
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-C', subtotal: 10000 });
    const paymentId = await payFor(orderId, { amount: 10000, status: 'pending' });

    expect(await postPaymentReceived(getDb(), paymentId)).toEqual({
      posted: false,
      reason: 'status_is_pending',
    });
  });

  test('is idempotent under a replayed webhook', async () => {
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-D', subtotal: 15000 });
    const paymentId = await payFor(orderId, { amount: 15000 });

    await postPaymentReceived(getDb(), paymentId);
    expect(await postPaymentReceived(getDb(), paymentId)).toEqual({
      posted: false,
      reason: 'already_posted',
    });
  });

  test('a confirmed then paid order leaves no outstanding receivable', async () => {
    const db = getDb();
    const orderId = await insertOrder({ orderNumber: 'ORD-PAY-E', subtotal: 44000 });
    await postOrderConfirmed(db, orderId);
    const paymentId = await payFor(orderId, { amount: 44000 });
    await postPaymentReceived(db, paymentId);

    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0)::bigint AS balance
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       JOIN accounts a ON a.id = l.account_id
       WHERE a.code = '1200' AND e.source_id IN ('${orderId}', '${paymentId}')`
    );
    expect(Number(row.balance)).toBe(0);
  });
});

describe('Stock movements post at cost', () => {
  test('a sale debits cost of goods sold and credits inventory', async () => {
    const productId = await insertProduct({ name: 'Costed sofa', cost_price: 20000 });
    const orderId = await insertOrder({ orderNumber: 'ORD-STK-1' });
    await recordMovement(productId, 10, 'purchase_receipt');
    const movementId = await recordMovement(productId, -3, 'sale', { orderId });

    const result = await postStockMovement(getDb(), movementId);
    expect(result.posted).toBe(true);

    expect(await linesOf('stock_movement', movementId)).toEqual([
      { code: '1300', debit: '0', credit: '60000' },
      { code: '5100', debit: '60000', credit: '0' },
    ]);
  });

  test('a purchase receipt debits inventory and credits the supplier', async () => {
    const productId = await insertProduct({ name: 'Received chair', cost_price: 5000 });
    const movementId = await recordMovement(productId, 4, 'purchase_receipt');

    await postStockMovement(getDb(), movementId);

    expect(await linesOf('stock_movement', movementId)).toEqual([
      { code: '1300', debit: '20000', credit: '0' },
      { code: '2100', debit: '0', credit: '20000' },
    ]);
  });

  test('damage is written off to expense', async () => {
    const productId = await insertProduct({ name: 'Broken table', cost_price: 8000 });
    await recordMovement(productId, 5, 'purchase_receipt');
    const movementId = await recordMovement(productId, -2, 'damage');

    await postStockMovement(getDb(), movementId);

    expect(await linesOf('stock_movement', movementId)).toEqual([
      { code: '1300', debit: '0', credit: '16000' },
      { code: '5400', debit: '16000', credit: '0' },
    ]);
  });

  test('a transfer between locations posts nothing', async () => {
    // Where stock is has changed; what it is worth has not.
    const productId = await insertProduct({ name: 'Moved stool', cost_price: 1000 });
    await recordMovement(productId, 5, 'purchase_receipt');
    const movementId = await recordMovement(productId, -1, 'transfer_out');

    expect(await postStockMovement(getDb(), movementId)).toEqual({
      posted: false,
      reason: 'no_value_change',
    });
  });

  test('SKIPS rather than invents a figure when no cost is known', async () => {
    // A cost of goods sold number conjured from nothing is worse than an absent
    // one, because it looks like a real margin.
    const productId = await insertProduct({ name: 'Uncosted item' }); // cost_price null
    const orderId = await insertOrder({ orderNumber: 'ORD-STK-2' });
    const movementId = await recordMovement(productId, -1, 'sale', { orderId });

    expect(await postStockMovement(getDb(), movementId)).toEqual({
      posted: false,
      reason: 'unknown_cost',
    });
  });

  test("prefers the movement's own cost over the product's current one", async () => {
    // What the goods actually cost when they moved, not what they cost today.
    const db = getDb();
    const productId = await insertProduct({ name: 'Repriced desk', cost_price: 9999 });
    const [[movement]] = await db.query(
      `INSERT INTO stock_movements (product_id, quantity, reason, unit_cost)
       VALUES ('${productId}', 2, 'purchase_receipt', 3000) RETURNING id`
    );

    await postStockMovement(db, movement.id);

    const lines = await linesOf('stock_movement', movement.id);
    expect(lines.find((l) => l.code === '1300').debit).toBe('6000');
  });

  test('an adjustment follows the sign of its quantity', async () => {
    const db = getDb();
    const productId = await insertProduct({ name: 'Counted lamp', cost_price: 2500 });
    await recordMovement(productId, 10, 'purchase_receipt');
    const down = await recordMovement(productId, -4, 'adjustment', { note: 'Stock take shortfall' });

    await postStockMovement(db, down);

    const lines = await linesOf('stock_movement', down);
    expect(lines.find((l) => l.code === '1300').credit).toBe('10000');
    expect(lines.find((l) => l.code === '5400').debit).toBe('10000');
  });

  test('is idempotent', async () => {
    const productId = await insertProduct({ name: 'Twice posted', cost_price: 100 });
    const movementId = await recordMovement(productId, 1, 'purchase_receipt');

    await postStockMovement(getDb(), movementId);
    expect(await postStockMovement(getDb(), movementId)).toEqual({
      posted: false,
      reason: 'already_posted',
    });
  });
});

describe('A full trading cycle', () => {
  test('buy, sell, get paid — and the books balance and show a margin', async () => {
    const db = getDb();
    const productId = await insertProduct({ name: 'Cycle sofa', price: 150000, cost_price: 90000 });

    // Buy two at ₦900 each.
    const receipt = await recordMovement(productId, 2, 'purchase_receipt');
    await postStockMovement(db, receipt);

    // Sell one at ₦1,500 plus ₦112.50 VAT.
    const orderId = await insertOrder({
      orderNumber: 'ORD-CYCLE-1',
      subtotal: 150000,
      tax: 11250,
    });
    await postOrderConfirmed(db, orderId);

    const issue = await recordMovement(productId, -1, 'sale', { orderId });
    await postStockMovement(db, issue);

    const paymentId = await payFor(orderId, { amount: 161250 });
    await postPaymentReceived(db, paymentId);

    const tb = await trialBalance(db);
    expect(tb.balanced).toBe(true);

    const balanceOf = (code) => tb.accounts.find((a) => a.code === code)?.balance ?? 0;

    // The numbers this whole migration exists to make possible: revenue against
    // its actual cost, which the Mongo schema could not express at all.
    const revenue = balanceOf('4100');
    const costOfSales = balanceOf('5100');
    expect(revenue).toBeGreaterThanOrEqual(150000);
    expect(costOfSales).toBeGreaterThanOrEqual(90000);
  });

  test('the ledger-wide imbalance view is still empty after every posting', async () => {
    const [rows] = await getDb().query('SELECT * FROM ledger_imbalance');
    expect(rows).toEqual([]);
  });
});

describe('Posting joins the caller transaction', () => {
  test('a failure after posting rolls the posting back', async () => {
    // Confirming a payment should record the payment and its posting together,
    // or neither.
    const db = getDb();
    const orderId = await insertOrder({ orderNumber: 'ORD-TX-1', subtotal: 7000 });

    await expect(
      db.transaction(async (transaction) => {
        await postOrderConfirmed(db, orderId, { transaction });
        throw new Error('the caller failed afterwards');
      })
    ).rejects.toThrow('the caller failed afterwards');

    const [[row]] = await db.query(
      `SELECT count(*)::int AS n FROM journal_entries WHERE source_id = '${orderId}'`
    );
    expect(row.n).toBe(0);
  });
});
