import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import { setupDatabase, teardownDatabase, getDb, insertProduct } from '../helpers/database.js';

// Money taken before it is earned, and the cut the gateway takes.
//
// Two things the ledger was quietly wrong about. Every payment posted as though
// it settled a receivable, so a deposit on an unconfirmed order cleared a debt
// that did not exist yet and left `1200` negative. And the whole amount was
// recorded as arriving in the bank, though the gateway keeps a percentage —
// so every cash balance was overstated by every fee ever charged.
//
// The figures: a sofa at ₦100,000, VAT at 10%, so an order of one is ₦110,000.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.70.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const suffix = Math.random().toString(36).slice(2);
  await registerStaff({
    username: `ops-${suffix}`,
    email: `ops-${suffix}@example.com`,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({
    email: `ops-${suffix}@example.com`,
    password: 'Password123!',
  });
  return asCookie(res);
}

const balanceOf = async (code) => {
  const res = await get('/api/books/trial-balance');
  return res.body.accounts.find((a) => a.code === code)?.balance ?? 0;
};

/** An order, left pending — nothing recognised, nothing owed yet. */
async function anOrder(quantity = 1) {
  const placed = await api('post', '/api/orders/create')
    .set('Cookie', [`anonymousId=anon-${Math.random().toString(36).slice(2)}`])
    .send({
      shippingAddress: {
        fullName: 'Ada Obi',
        phone: '08030000000',
        email: 'ada@example.com',
        address: '12 Ikoyi Crescent',
        city: 'Lagos',
        state: 'Lagos',
      },
      items: [{ item: sofaId, quantity }],
    });

  return placed.body.order;
}

/**
 * Money arriving against an order, posted directly.
 *
 * The gateway path needs a live Paystack; what is under test is the posting
 * rule, so the receipt is written the way the service writes it and posted.
 */
async function receive(order, amount, { fee = 0, method = 'bank_transfer' } = {}) {
  const { postPaymentReceived } = await import('../../src/services/posting.js');

  const [[receipt]] = await getDb().query(
    `INSERT INTO payment_transactions
       (order_id, amount, payment_method, status, verified_at, gateway_fee)
     VALUES (:orderId, :amount, :method::payment_method, 'success', now(), :fee)
     RETURNING id`,
    { replacements: { orderId: order._id, amount, method, fee } }
  );

  const posted = await postPaymentReceived(getDb(), receipt.id);
  // After the spread, not before: the posting result carries the journal
  // entry's own id and would otherwise overwrite the receipt's.
  return { ...posted, receiptId: receipt.id };
}

const confirm = (order) =>
  api('put', `/api/orders/admin/${order._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'confirmed' });

beforeAll(async () => {
  await setupDatabase();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '10';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
  sofaId = await insertProduct({
    name: 'Deposit Sofa',
    price: 10000000,
    cost_price: 4000000,
    sku: 'DEP-1',
  });
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('money taken before the sale is recognised', () => {
  it('is held as a deposit, not as a receivable cleared', async () => {
    const deposits = await balanceOf('2300');
    const receivable = await balanceOf('1200');

    const order = await anOrder();
    const posted = await receive(order, 5000000); // ₦50,000 up front

    expect(posted.heldAsDeposit).toBe(true);
    expect(await balanceOf('2300')).toBe(deposits + 50000);

    // The old rule credited 1200 here, clearing a debt that did not exist yet.
    expect(await balanceOf('1200')).toBe(receivable);
  });

  it('is recorded on the receipt, as a fact about when the money arrived', async () => {
    const order = await anOrder();
    const posted = await receive(order, 5000000);

    const [receipt] = await rows(
      'SELECT held_as_deposit, deposit_applied_at FROM payment_transactions WHERE id = :id',
      { id: posted.receiptId }
    );

    expect(receipt.held_as_deposit).toBe(true);
    expect(receipt.deposit_applied_at).toBeNull();
  });

  it('becomes a settlement of what is owed once the sale is recognised', async () => {
    const deposits = await balanceOf('2300');
    const receivable = await balanceOf('1200');

    const order = await anOrder();
    await receive(order, 5000000);
    await confirm(order);

    // The sale raised ₦110,000 owed; the deposit released ₦50,000 of it.
    expect(await balanceOf('1200')).toBe(receivable + 60000);
    expect(await balanceOf('2300')).toBe(deposits);
  });

  it('marks the deposit applied, and does not apply it twice', async () => {
    const order = await anOrder();
    const posted = await receive(order, 5000000);
    await confirm(order);

    const [receipt] = await rows(
      'SELECT deposit_applied_at FROM payment_transactions WHERE id = :id',
      { id: posted.receiptId }
    );
    expect(receipt.deposit_applied_at).not.toBeNull();

    // Confirming again — which the status route guards, but the rule must be
    // safe on its own — writes nothing further.
    const { postDepositsApplied } = await import('../../src/services/posting.js');
    const again = await postDepositsApplied(getDb(), order._id);
    expect(again.applied).toBe(0);
  });

  it('handles several deposits against one order', async () => {
    const receivable = await balanceOf('1200');

    const order = await anOrder(2); // ₦220,000
    await receive(order, 5000000);
    await receive(order, 3000000);
    await confirm(order);

    // ₦220,000 owed less ₦80,000 already paid.
    expect(await balanceOf('1200')).toBe(receivable + 140000);
  });

  it('leaves the books in balance', async () => {
    const order = await anOrder();
    await receive(order, 4000000);
    await confirm(order);

    const res = await get('/api/books/trial-balance');
    expect(res.body.balanced).toBe(true);
  });
});

describe('money taken after the sale is recognised', () => {
  it('settles the receivable, as it always did', async () => {
    const deposits = await balanceOf('2300');

    const order = await anOrder();
    await confirm(order);

    const receivable = await balanceOf('1200');
    const posted = await receive(order, 11000000);

    expect(posted.heldAsDeposit).toBe(false);
    expect(await balanceOf('1200')).toBe(receivable - 110000);
    // Nothing touched the deposit account.
    expect(await balanceOf('2300')).toBe(deposits);
  });
});

describe('recording a payment by hand', () => {
  const takePayment = (order, body) =>
    api('post', `/api/orders/admin/${order._id}/payments`).set('Cookie', adminCookie).send(body);

  it('holds it as a deposit when nothing has been recognised yet', async () => {
    const deposits = await balanceOf('2300');
    const order = await anOrder();

    const res = await takePayment(order, { amount: 40000, method: 'bank_transfer' });

    expect(res.status).toBe(201);
    expect(res.body.heldAsDeposit).toBe(true);
    expect(res.body.outstanding).toBe(70000);
    expect(res.body.message).toMatch(/held as a deposit/i);
    expect(await balanceOf('2300')).toBe(deposits + 40000);
  });

  it('settles what is owed when the sale has been recognised', async () => {
    const order = await anOrder();
    await confirm(order);

    const receivable = await balanceOf('1200');
    const res = await takePayment(order, { amount: 110000 });

    expect(res.body.heldAsDeposit).toBe(false);
    expect(res.body.fullyPaid).toBe(true);
    expect(await balanceOf('1200')).toBe(receivable - 110000);
  });

  it('marks the order paid once the whole amount is in', async () => {
    const order = await anOrder();
    await takePayment(order, { amount: 60000 });
    await takePayment(order, { amount: 50000 });

    const [row] = await rows('SELECT payment_status::text FROM orders WHERE id = :id', {
      id: order._id,
    });
    expect(row.payment_status).toBe('paid');
  });

  it('refuses more than the order is worth', async () => {
    const order = await anOrder();
    const res = await takePayment(order, { amount: 200000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/more than the order is worth/i);
  });

  it('refuses a zero or negative amount, and an unknown method', async () => {
    const order = await anOrder();

    expect((await takePayment(order, { amount: 0 })).status).toBe(400);
    expect((await takePayment(order, { amount: -5 })).status).toBe(400);
    expect((await takePayment(order, { amount: 100, method: 'goat' })).status).toBe(400);
  });

  it('needs orders.manage', async () => {
    const support = await signInAsOperator('support');
    const order = await anOrder();

    const res = await api('post', `/api/orders/admin/${order._id}/payments`)
      .set('Cookie', support)
      .send({ amount: 1000 });

    expect(res.status).toBe(403);
  });
});

describe("the gateway's cut", () => {
  it('goes to processing fees, and only the rest reaches the bank', async () => {
    const bank = await balanceOf('1120');
    const fees = await balanceOf('5300');

    const order = await anOrder();
    await confirm(order);
    await receive(order, 11000000, { fee: 165000 }); // ₦1,650 of ₦110,000

    expect(await balanceOf('1120')).toBe(bank + 108350);
    expect(await balanceOf('5300')).toBe(fees + 1650);
  });

  it('still clears the whole receivable — the customer paid in full', async () => {
    const order = await anOrder();
    await confirm(order);

    const receivable = await balanceOf('1200');
    await receive(order, 11000000, { fee: 165000 });

    // What they owed is settled by what they paid, not by what we netted.
    expect(await balanceOf('1200')).toBe(receivable - 110000);
  });

  it('charges nothing on a transfer or cash', async () => {
    const fees = await balanceOf('5300');

    const order = await anOrder();
    await confirm(order);
    await receive(order, 11000000);

    expect(await balanceOf('5300')).toBe(fees);
  });

  it('takes its fee out of a deposit too', async () => {
    const fees = await balanceOf('5300');
    const deposits = await balanceOf('2300');
    const bank = await balanceOf('1120');

    const order = await anOrder();
    await receive(order, 5000000, { fee: 75000 }); // ₦750 of ₦50,000

    // The customer is owed the whole deposit; the fee is our cost, not theirs.
    expect(await balanceOf('2300')).toBe(deposits + 50000);
    expect(await balanceOf('5300')).toBe(fees + 750);
    expect(await balanceOf('1120')).toBe(bank + 49250);
  });

  it('refuses a fee larger than the payment', async () => {
    const order = await anOrder();

    await expect(
      getDb().query(
        `INSERT INTO payment_transactions (order_id, amount, payment_method, status, verified_at, gateway_fee)
         VALUES (:orderId, 1000, 'paystack', 'success', now(), 2000)`,
        { replacements: { orderId: order._id } }
      )
    ).rejects.toThrow(/payment_fee_within_amount/);
  });
});
