import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  currentDatabaseUrl,
  insertProduct,
} from '../helpers/database.js';

// The buying side.
//
// Every assertion here is really the same question asked twice: did the
// document change state, and did the books change with it? An expense that says
// "paid" while the payable is still standing is the failure this module exists
// to make impossible.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let vendorId;
let chairId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.20.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);
const patch = (path, body = {}) => api('patch', path).set('Cookie', adminCookie).send(body);
const del = (path) => api('delete', path).set('Cookie', adminCookie);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `buy-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `buy-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
}

/** The balance of one account, in naira, from the trial balance. */
const balanceOf = async (code) => {
  const res = await get('/api/books/trial-balance');
  return res.body.accounts.find((a) => a.code === code)?.balance ?? 0;
};

const anExpense = async (overrides = {}) =>
  (
    await post('/api/purchasing/expenses', {
      vendorId,
      accountCode: '5600', // rent
      description: 'Workshop rent',
      date: '2026-01-15',
      netAmount: 200000,
      ...overrides,
    })
  ).body.expense;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  chairId = await insertProduct({
    name: 'Purchasing Chair',
    price: 5000000, // ₦50,000
    cost_price: 2000000, // ₦20,000
    sku: 'PURCH-1',
  });

  const created = await post('/api/purchasing/vendors', { name: 'Timber & Co' });
  vendorId = created.body.vendor._id;
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

describe('vendors', () => {
  it('records one, and lists it with nothing outstanding', async () => {
    const created = await post('/api/purchasing/vendors', {
      name: 'Fabric House',
      email: 'sales@fabric.example',
      phone: '08030000000',
    });

    expect(created.status).toBe(201);
    expect(created.body.vendor.name).toBe('Fabric House');
    expect(created.body.vendor.isActive).toBe(true);

    const list = await get('/api/purchasing/vendors');
    const found = list.body.vendors.find((v) => v._id === created.body.vendor._id);
    expect(found.outstanding).toBe(0);
  });

  it('refuses a second vendor with the same name', async () => {
    await post('/api/purchasing/vendors', { name: 'Twice Ltd' });
    const again = await post('/api/purchasing/vendors', { name: 'Twice Ltd' });

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already a vendor/i);
  });

  it('needs a name', async () => {
    const res = await post('/api/purchasing/vendors', { email: 'nobody@example.com' });
    expect(res.status).toBe(400);
  });

  it('updates one', async () => {
    const created = await post('/api/purchasing/vendors', { name: 'Renamed Ltd' });
    const res = await patch(`/api/purchasing/vendors/${created.body.vendor._id}`, {
      name: 'Renamed Plc',
      phone: '08099999999',
    });

    expect(res.status).toBe(200);
    expect(res.body.vendor.name).toBe('Renamed Plc');
    expect(res.body.vendor.phone).toBe('08099999999');
  });

  it('deletes one that was never used', async () => {
    const created = await post('/api/purchasing/vendors', { name: 'Unused Ltd' });
    const res = await del(`/api/purchasing/vendors/${created.body.vendor._id}`);

    expect(res.status).toBe(200);
    expect(res.body.deactivated).toBe(false);
  });

  // History is not deletable, so a supplier with any is retired instead. The
  // alternative is a payables report that cannot say who is owed.
  it('deactivates rather than deletes one with history', async () => {
    const created = await post('/api/purchasing/vendors', { name: 'Historic Ltd' });
    await anExpense({ vendorId: created.body.vendor._id });

    const res = await del(`/api/purchasing/vendors/${created.body.vendor._id}`);

    expect(res.status).toBe(200);
    expect(res.body.deactivated).toBe(true);
  });
});

describe('recording an expense', () => {
  it('starts as a draft and posts nothing', async () => {
    const before = await balanceOf('2100');
    const expense = await anExpense();

    expect(expense.status).toBe('draft');
    expect(expense.expenseNumber).toMatch(/^EXP-\d{4}-\d{5}$/);
    expect(expense.totalAmount).toBe(200000);
    expect(await balanceOf('2100')).toBe(before);
  });

  it('adds tax to the total, and keeps the two apart', async () => {
    const expense = await anExpense({ netAmount: 100000, taxAmount: 7500 });

    expect(expense.netAmount).toBe(100000);
    expect(expense.taxAmount).toBe(7500);
    expect(expense.totalAmount).toBe(107500);
  });

  it('refuses an account that is not in the chart', async () => {
    const res = await post('/api/purchasing/expenses', {
      accountCode: '9999',
      description: 'Nowhere',
      date: '2026-01-15',
      netAmount: 1000,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No account 9999/);
  });

  // A cost filed under a summary account would never appear in any report
  // under it, because the reports read postable accounts.
  it('refuses a summary account', async () => {
    const [summary] = await rows(
      `SELECT code FROM accounts WHERE NOT is_postable AND type = 'expense' LIMIT 1`
    );
    if (!summary) return;

    const res = await post('/api/purchasing/expenses', {
      accountCode: summary.code,
      description: 'Summary',
      date: '2026-01-15',
      netAmount: 1000,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/summary account/);
  });

  it('refuses a negative amount', async () => {
    const res = await post('/api/purchasing/expenses', {
      accountCode: '5600',
      description: 'Negative',
      date: '2026-01-15',
      netAmount: -5000,
    });

    expect(res.status).toBe(400);
  });

  it('needs a description, a date and an amount', async () => {
    for (const missing of ['description', 'date', 'netAmount']) {
      const body = {
        accountCode: '5600',
        description: 'Something',
        date: '2026-01-15',
        netAmount: 1000,
      };
      delete body[missing];

      const res = await post('/api/purchasing/expenses', body);
      expect(res.status).toBe(400);
    }
  });
});

describe('approving an expense', () => {
  it('books the cost and the debt', async () => {
    const rent = await balanceOf('5600');
    const payable = await balanceOf('2100');

    const expense = await anExpense({ netAmount: 150000 });
    const res = await post(`/api/purchasing/expenses/${expense._id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.expense.status).toBe('approved');
    expect(res.body.expense.approvedBy).toBeTruthy();

    // The cost is an expense and the money is owed: one entry, both sides.
    expect(await balanceOf('5600')).toBe(rent + 150000);
    expect(await balanceOf('2100')).toBe(payable + 150000);
  });

  it('splits input VAT out of the cost', async () => {
    const rent = await balanceOf('5600');
    const vat = await balanceOf('2200');
    const payable = await balanceOf('2100');

    const expense = await anExpense({ netAmount: 100000, taxAmount: 7500 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    // The cost is the net; the VAT is recoverable, so it reduces what is owed
    // to the tax authority rather than being an expense of its own.
    expect(await balanceOf('5600')).toBe(rent + 100000);
    expect(await balanceOf('2200')).toBe(vat - 7500);
    expect(await balanceOf('2100')).toBe(payable + 107500);
  });

  it('writes one journal entry, sourced to the expense', async () => {
    const expense = await anExpense({ netAmount: 40000 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    const entries = await rows(
      `SELECT id FROM journal_entries WHERE source = 'expense' AND source_id = :id`,
      { id: expense._id }
    );

    expect(entries).toHaveLength(1);
  });

  it('refuses to approve twice', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    const again = await post(`/api/purchasing/expenses/${expense._id}/approve`);

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already approved/i);
  });

  it('404s on an expense that does not exist', async () => {
    const res = await post(
      '/api/purchasing/expenses/00000000-0000-0000-0000-000000000000/approve'
    );
    expect(res.status).toBe(404);
  });
});

describe('paying an expense', () => {
  it('clears the payable and takes the money out of the bank', async () => {
    const payable = await balanceOf('2100');
    const bank = await balanceOf('1120');

    const expense = await anExpense({ netAmount: 80000 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    const res = await post(`/api/purchasing/expenses/${expense._id}/pay`, {
      paymentMethod: 'bank_transfer',
      paidOn: '2026-01-20',
    });

    expect(res.status).toBe(200);
    expect(res.body.expense.status).toBe('paid');
    expect(res.body.expense.paidOn).toBeTruthy();

    // Approve then pay nets the payable back to where it started.
    expect(await balanceOf('2100')).toBe(payable);
    expect(await balanceOf('1120')).toBe(bank - 80000);
  });

  it('takes cash out of the cash account instead', async () => {
    const cash = await balanceOf('1130');

    const expense = await anExpense({ netAmount: 30000 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    await post(`/api/purchasing/expenses/${expense._id}/pay`, {
      paymentMethod: 'cash_on_delivery',
    });

    expect(await balanceOf('1130')).toBe(cash - 30000);
  });

  // Paying something nobody approved would put money out of the bank against a
  // debt the books never recognised.
  it('refuses to pay a draft', async () => {
    const expense = await anExpense();
    const res = await post(`/api/purchasing/expenses/${expense._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/approved expense/i);
  });

  it('refuses to pay twice', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    await post(`/api/purchasing/expenses/${expense._id}/pay`, { paymentMethod: 'bank_transfer' });
    const again = await post(`/api/purchasing/expenses/${expense._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already paid/i);
  });

  it('treats an empty payment date as today', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    const res = await post(`/api/purchasing/expenses/${expense._id}/pay`, {
      paymentMethod: 'bank_transfer',
      paidOn: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.expense.paidOn).toBeTruthy();
  });

  it('needs to know how it was paid', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    expect((await post(`/api/purchasing/expenses/${expense._id}/pay`, {})).status).toBe(400);
    expect(
      (await post(`/api/purchasing/expenses/${expense._id}/pay`, { paymentMethod: 'goat' })).status
    ).toBe(400);
  });
});

describe('voiding an expense', () => {
  it('voids a draft', async () => {
    const expense = await anExpense();
    const res = await post(`/api/purchasing/expenses/${expense._id}/void`);

    expect(res.status).toBe(200);
    expect(res.body.expense.status).toBe('void');
  });

  // Once it is in the books the way back is a reversing entry, not a status
  // change. That is the difference between a ledger and a spreadsheet.
  it('refuses to void something that is already posted', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);
    const res = await post(`/api/purchasing/expenses/${expense._id}/void`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reverse its journal entry/i);
  });
});

describe('the expense list', () => {
  it('filters by status and reports what the filtered set is worth', async () => {
    const res = await get('/api/purchasing/expenses?status=paid');

    expect(res.status).toBe(200);
    expect(res.body.expenses.every((e) => e.status === 'paid')).toBe(true);
    expect(res.body.totalValue).toBeGreaterThan(0);
  });

  it('filters by date', async () => {
    const outside = await anExpense({ date: '2026-03-01', netAmount: 12345 });
    const res = await get('/api/purchasing/expenses?from=2026-02-01&to=2026-02-28');

    expect(res.body.expenses.some((e) => e._id === outside._id)).toBe(false);
  });

  it('shows the vendor and the account on each row', async () => {
    const res = await get('/api/purchasing/expenses?limit=1');
    const [first] = res.body.expenses;

    expect(first.account.code).toBeTruthy();
    expect(first.account.name).toBeTruthy();
  });
});

describe('payables', () => {
  it('ages what is owed, and drops it once paid', async () => {
    const vendor = await post('/api/purchasing/vendors', { name: 'Ageing Ltd' });
    const id = vendor.body.vendor._id;

    const expense = await anExpense({ vendorId: id, netAmount: 90000 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    const owed = await get('/api/purchasing/payables');
    const line = owed.body.payables.find((p) => p.vendor?._id === id);
    expect(line.total).toBe(90000);

    await post(`/api/purchasing/expenses/${expense._id}/pay`, { paymentMethod: 'bank_transfer' });

    const after = await get('/api/purchasing/payables');
    expect(after.body.payables.find((p) => p.vendor?._id === id)).toBeUndefined();
  });

  it('shows what is outstanding against each vendor on the vendor list', async () => {
    const vendor = await post('/api/purchasing/vendors', { name: 'Owed Ltd' });
    const id = vendor.body.vendor._id;

    const expense = await anExpense({ vendorId: id, netAmount: 45000 });
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    const list = await get('/api/purchasing/vendors');
    expect(list.body.vendors.find((v) => v._id === id).outstanding).toBe(45000);
  });
});

describe('purchase orders', () => {
  const anOrder = async (overrides = {}) =>
    (
      await post('/api/purchasing/purchase-orders', {
        vendorId,
        expectedOn: '2026-02-01',
        items: [{ product: chairId, quantity: 10, unitCost: 20000 }],
        ...overrides,
      })
    ).body.purchaseOrder;

  it('totals its lines', async () => {
    const order = await anOrder();

    expect(order.poNumber).toMatch(/^PO-\d{4}-\d{5}$/);
    expect(order.status).toBe('draft');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].lineTotal).toBe(200000);
    expect(order.total).toBe(200000);
  });

  it('needs a vendor and at least one line', async () => {
    expect((await post('/api/purchasing/purchase-orders', { items: [] })).status).toBe(400);
    expect((await post('/api/purchasing/purchase-orders', { vendorId, items: [] })).status).toBe(
      400
    );
  });

  // A blank date input posts "", and ''::date is a syntax error rather than a
  // null date, so an empty "expected on" used to be a 500.
  it('treats an empty expected date as no date', async () => {
    const res = await post('/api/purchasing/purchase-orders', {
      vendorId,
      expectedOn: '',
      items: [{ product: chairId, quantity: 1, unitCost: 20000 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.purchaseOrder.expectedOn).toBeNull();
  });

  it('refuses a fractional quantity', async () => {
    const res = await post('/api/purchasing/purchase-orders', {
      vendorId,
      items: [{ product: chairId, quantity: 1.5, unitCost: 20000 }],
    });

    expect(res.status).toBe(400);
  });

  it('refuses a product that does not exist', async () => {
    const res = await post('/api/purchasing/purchase-orders', {
      vendorId,
      items: [{ product: '00000000-0000-0000-0000-000000000000', quantity: 1, unitCost: 100 }],
    });

    expect(res.status).toBe(400);
  });

  it('sends a draft, and refuses to send it twice', async () => {
    const order = await anOrder();

    const sent = await post(`/api/purchasing/purchase-orders/${order._id}/send`);
    expect(sent.body.purchaseOrder.status).toBe('sent');

    const again = await post(`/api/purchasing/purchase-orders/${order._id}/send`);
    expect(again.status).toBe(400);
  });

  it('posts nothing until the goods arrive', async () => {
    const inventory = await balanceOf('1300');
    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/send`);

    expect(await balanceOf('1300')).toBe(inventory);
  });

  // Receiving is the moment a document becomes stock and a debt.
  it('brings stock in and raises the payable when received', async () => {
    const inventory = await balanceOf('1300');
    const payable = await balanceOf('2100');

    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/send`);
    const res = await post(`/api/purchasing/purchase-orders/${order._id}/receive`, {
      receivedOn: '2026-02-03',
    });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe('received');
    expect(res.body.purchaseOrder.receivedOn).toBeTruthy();

    expect(await balanceOf('1300')).toBe(inventory + 200000);
    expect(await balanceOf('2100')).toBe(payable + 200000);
  });

  it('writes a stock movement carrying the cost that was agreed', async () => {
    const order = await anOrder({
      items: [{ product: chairId, quantity: 4, unitCost: 25000 }],
    });
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);

    const [movement] = await rows(
      `SELECT quantity, reason, unit_cost FROM stock_movements
        WHERE purchase_order_id = :id`,
      { id: order._id }
    );

    expect(movement.reason).toBe('purchase_receipt');
    expect(movement.quantity).toBe(4);
    // The cost ordered, not the product's ₦20,000 cost price: what the business
    // owes is what it agreed to pay.
    expect(Number(movement.unit_cost)).toBe(2500000);
  });

  it('raises the stock on hand', async () => {
    const [before] = await rows(
      `SELECT COALESCE(SUM(quantity), 0)::int AS on_hand FROM stock_movements
        WHERE product_id = :id`,
      { id: chairId }
    );

    const order = await anOrder({ items: [{ product: chairId, quantity: 7, unitCost: 20000 }] });
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);

    const [after] = await rows(
      `SELECT COALESCE(SUM(quantity), 0)::int AS on_hand FROM stock_movements
        WHERE product_id = :id`,
      { id: chairId }
    );

    expect(after.on_hand).toBe(before.on_hand + 7);
  });

  // Receiving raises the debt; this settles it. Without it, 2100 accumulated
  // every receipt for ever and the payables list disagreed with the books.
  it('pays for what was received, clearing the payable', async () => {
    const payable = await balanceOf('2100');
    const bank = await balanceOf('1120');

    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);
    const res = await post(`/api/purchasing/purchase-orders/${order._id}/pay`, {
      paymentMethod: 'bank_transfer',
      paidOn: '2026-02-10',
    });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.paidOn).toBeTruthy();

    // Received then paid nets the payable back to where it started.
    expect(await balanceOf('2100')).toBe(payable);
    expect(await balanceOf('1120')).toBe(bank - 200000);
  });

  // Paying for goods that have not arrived is a deposit or a mistake.
  it('refuses to pay for an order that has not arrived', async () => {
    const order = await anOrder();
    const res = await post(`/api/purchasing/purchase-orders/${order._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/received order/i);
  });

  it('refuses to pay twice', async () => {
    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);
    await post(`/api/purchasing/purchase-orders/${order._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });
    const again = await post(`/api/purchasing/purchase-orders/${order._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already paid/i);
  });

  it('shows an unpaid receipt on the payables list', async () => {
    const vendor = await post('/api/purchasing/vendors', { name: 'Unbilled Ltd' });
    const id = vendor.body.vendor._id;

    const order = await anOrder({ vendorId: id });
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);

    const owed = await get('/api/purchasing/payables');
    expect(owed.body.payables.find((p) => p.vendor?._id === id).total).toBe(200000);

    await post(`/api/purchasing/purchase-orders/${order._id}/pay`, {
      paymentMethod: 'bank_transfer',
    });

    const after = await get('/api/purchasing/payables');
    expect(after.body.payables.find((p) => p.vendor?._id === id)).toBeUndefined();
  });

  it('refuses to receive twice', async () => {
    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/receive`);
    const again = await post(`/api/purchasing/purchase-orders/${order._id}/receive`);

    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already received/i);
  });

  it('cancels an open order but not a received one', async () => {
    const open = await anOrder();
    expect((await post(`/api/purchasing/purchase-orders/${open._id}/cancel`)).status).toBe(200);

    const received = await anOrder();
    await post(`/api/purchasing/purchase-orders/${received._id}/receive`);
    const res = await post(`/api/purchasing/purchase-orders/${received._id}/cancel`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Return the stock/i);
  });

  it('refuses to receive a cancelled order', async () => {
    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/cancel`);
    const res = await post(`/api/purchasing/purchase-orders/${order._id}/receive`);

    expect(res.status).toBe(400);
  });

  it('filters the list by status', async () => {
    const res = await get('/api/purchasing/purchase-orders?status=received');

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrders.every((o) => o.status === 'received')).toBe(true);
  });
});

describe('the books stay balanced through all of it', () => {
  it('still balances', async () => {
    const res = await get('/api/books/trial-balance');

    expect(res.body.balanced).toBe(true);
    expect(res.body.totalDebit).toBe(res.body.totalCredit);
  });

  // The whole point of migration 0012: the profit and loss now has costs below
  // the gross margin, so it can show a profit rather than stopping halfway.
  it('shows operating costs on the profit and loss', async () => {
    const res = await get('/api/books/reports/profit-and-loss?from=2026-01-01&to=2026-12-31');

    expect(res.status).toBe(200);
    expect(res.body.operatingExpenses.total).toBeGreaterThan(0);
    expect(res.body.operatingExpenses.lines.some((line) => line.code === '5600')).toBe(true);
  });

  it('counts input VAT against what is owed on sales', async () => {
    const res = await get('/api/books/reports/vat?from=2026-01-01&to=2026-12-31');

    expect(res.status).toBe(200);
    expect(res.body.inputVat).toBeGreaterThan(0);
  });
});

describe('who may buy', () => {
  it('keeps an operator without the permission out', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('post', '/api/purchasing/vendors')
      .set('Cookie', editor)
      .send({ name: 'Sneaky Ltd' });

    expect(res.status).toBe(403);
  });

  it('keeps the public out entirely', async () => {
    expect((await api('get', '/api/purchasing/expenses')).status).toBe(401);
  });
});
