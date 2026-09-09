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
  recordMovement,
} from '../helpers/database.js';

// Writing things down.
//
// Three gaps this covers, all of them the same complaint: the console could
// read the business but not record it. A customer could not be added, a sale
// made in the showroom had nowhere to go, and a draft with a typo in it could
// only be voided.
//
// The assertions that matter are the ledger ones. A counter sale that produces
// an order but no revenue would look right on the screen and be missing from
// every report, which is the failure mode worth a test.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let sofaId;
let vendorId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.60.${(callers >> 8) & 255}.${callers++ & 255}`);

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
  const email = `till-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `till-${Math.random().toString(36).slice(2)}`,
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

const anEmail = () => `walkin-${Math.random().toString(36).slice(2)}@example.com`;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  sofaId = await insertProduct({
    name: 'Showroom Sofa',
    price: 45000000, // ₦450,000 on the tag
    cost_price: 20000000, // ₦200,000 to make
    sku: 'COUNTER-1',
  });

  // Enough stock that a sale can actually leave the building.
  await recordMovement(sofaId, 40, 'purchase_receipt');

  vendorId = (await post('/api/purchasing/vendors', { name: 'Counter Supplies' })).body.vendor._id;
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

describe('adding a customer from the console', () => {
  it('records one, and finds them again by search', async () => {
    const email = anEmail();

    const created = await post('/api/customers', {
      fullName: 'Adaeze Okonkwo',
      email,
      phoneNumber: '08030000001',
    });

    expect(created.status).toBe(201);
    expect(created.body.customer.username).toBe('Adaeze Okonkwo');

    const found = await get(`/api/customers?search=${encodeURIComponent('Adaeze')}`);
    expect(found.body.customers.some((c) => c._id === created.body.customer._id)).toBe(true);
  });

  it('gives them no password, so the record can never be signed in to', async () => {
    const created = await post('/api/customers', { fullName: 'No Login', email: anEmail() });

    const [row] = await rows(
      'SELECT password_hash, supabase_user_id FROM customers WHERE id = :id',
      { id: created.body.customer._id }
    );

    expect(row.password_hash).toBeNull();
    expect(row.supabase_user_id).not.toBeNull();
  });

  it('refuses a second record with the same email', async () => {
    const email = anEmail();
    await post('/api/customers', { fullName: 'First', email });

    const again = await post('/api/customers', { fullName: 'Second', email });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already has that email/i);
  });

  it('needs a name and an email', async () => {
    expect((await post('/api/customers', { email: anEmail() })).status).toBe(400);
    expect((await post('/api/customers', { fullName: 'Nameless' })).status).toBe(400);
  });

  it('corrects details, and leaves the fields that were not sent alone', async () => {
    const created = await post('/api/customers', {
      fullName: 'Typo Nmae',
      email: anEmail(),
      phoneNumber: '08030000002',
    });

    const fixed = await patch(`/api/customers/${created.body.customer._id}`, {
      fullName: 'Typo Name',
    });

    expect(fixed.status).toBe(200);
    expect(fixed.body.customer.username).toBe('Typo Name');
    expect(fixed.body.customer.phoneNumber).toBe('08030000002');
  });

  it('will not move an email onto somebody who already has it', async () => {
    const taken = anEmail();
    await post('/api/customers', { fullName: 'Holder', email: taken });
    const other = await post('/api/customers', { fullName: 'Other', email: anEmail() });

    const clash = await patch(`/api/customers/${other.body.customer._id}`, { email: taken });
    expect(clash.status).toBe(400);
  });

  it('deletes one who has never ordered', async () => {
    const created = await post('/api/customers', { fullName: 'Never Bought', email: anEmail() });

    const removed = await del(`/api/customers/${created.body.customer._id}`);
    expect(removed.status).toBe(200);

    const gone = await get(`/api/customers/${created.body.customer._id}`);
    expect(gone.status).toBe(404);
  });

  it('refuses to delete somebody whose name is on an order', async () => {
    const created = await post('/api/customers', { fullName: 'Has Bought', email: anEmail() });

    await post('/api/orders/admin/sales', {
      customerId: created.body.customer._id,
      items: [{ product: sofaId, quantity: 1, unitPrice: 400000 }],
    });

    const refused = await del(`/api/customers/${created.body.customer._id}`);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/order/i);
  });
});

// ---------------------------------------------------------------------------
// Counter sales
// ---------------------------------------------------------------------------

describe('recording a sale made in person', () => {
  it('books revenue, cost of sale and cash at the price that was agreed', async () => {
    const revenueBefore = await balanceOf('4100');
    const cashBefore = await balanceOf('1130');
    const cogsBefore = await balanceOf('5100');

    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 380000 }], // haggled down from 450,000
      paymentMethod: 'cash_on_delivery',
      customer: { fullName: 'Walk-in Wale' },
    });

    expect(sale.status).toBe(201);
    expect(sale.body.order.status).toBe('confirmed');
    expect(sale.body.order.subtotal).toBe(380000);
    expect(sale.body.outstanding).toBe(0);

    // The agreed price is what reached the books, not the ₦450,000 on the tag.
    // Revenue is the net figure; the cash box gets the VAT-inclusive total.
    expect(await balanceOf('4100')).toBeCloseTo(revenueBefore + 380000, 2);
    expect(await balanceOf('1130')).toBeCloseTo(cashBefore + sale.body.order.totalAmount, 2);
    expect(await balanceOf('5100')).toBeCloseTo(cogsBefore + 200000, 2);
  });

  it('is indistinguishable from an online order once recorded', async () => {
    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 400000 }],
      customer: { fullName: 'Walk-in Two' },
      deliveredNow: true,
    });

    const [row] = await rows('SELECT order_number, status FROM orders WHERE id = :id', {
      id: sale.body.order._id,
    });

    expect(row.order_number).toMatch(/^ORD-/);
    expect(row.status).toBe('delivered');

    const listed = await get('/api/orders/admin/all?limit=100');
    expect(listed.body.orders.some((o) => o._id === sale.body.order._id)).toBe(true);
  });

  it('takes stock out of the building', async () => {
    const before = await rows(
      `SELECT COALESCE(SUM(quantity), 0)::int AS held FROM stock_movements WHERE product_id = :id`,
      { id: sofaId }
    );

    await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 2, unitPrice: 300000 }],
      customer: { fullName: 'Bulk Buyer' },
    });

    const after = await rows(
      `SELECT COALESCE(SUM(quantity), 0)::int AS held FROM stock_movements WHERE product_id = :id`,
      { id: sofaId }
    );

    expect(after[0].held).toBe(before[0].held - 2);
  });

  it('leaves the balance owing when only part of the money was handed over', async () => {
    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 500000 }],
      customer: { fullName: 'Part Payer' },
      amountPaid: 200000,
    });

    expect(sale.body.outstanding).toBe(sale.body.order.totalAmount - 200000);
    expect(sale.body.outstanding).toBeGreaterThan(0);
    expect(sale.body.order.paymentStatus).not.toBe('paid');

    // And it shows up as a debt in the receivables ageing, which is the report
    // somebody chases from.
    const ageing = await get('/api/books/receivables');
    expect(ageing.status).toBe(200);
    expect(Number(ageing.body.totals.total)).toBeGreaterThan(0);
  });

  it('records nothing owed as nothing paid when it went out on account', async () => {
    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 250000 }],
      customer: { fullName: 'On Account' },
      amountPaid: 0,
    });

    expect(sale.body.payment).toBeNull();
    expect(sale.body.outstanding).toBe(sale.body.order.totalAmount);
  });

  it('keeps a new customer, and attaches the order to them', async () => {
    const email = anEmail();

    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 320000 }],
      customer: { fullName: 'Kept Contact', email, phone: '08030000009' },
    });

    expect(sale.body.customer).not.toBeNull();

    const found = await get(`/api/customers?search=${encodeURIComponent(email)}`);
    expect(found.body.customers).toHaveLength(1);
    expect(found.body.customers[0].orderCount).toBe(1);
  });

  it('adopts an existing customer rather than making a second record of them', async () => {
    const email = anEmail();
    await post('/api/customers', { fullName: 'Already Known', email });

    await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 100000 }],
      customer: { fullName: 'Already Known', email },
    });

    const found = await get(`/api/customers?search=${encodeURIComponent(email)}`);
    expect(found.body.customers).toHaveLength(1);
  });

  it('refuses a sale with no lines', async () => {
    const res = await post('/api/orders/admin/sales', { customer: { fullName: 'Nobody' } });
    expect(res.status).toBe(400);
  });

  it('refuses a price that is not a number', async () => {
    const res = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 'free' }],
      customer: { fullName: 'Chancer' },
    });

    expect(res.status).toBe(400);
  });

  it('still refuses a price sent from a browser at the storefront checkout', async () => {
    // The whole security of the override: the same field, on the public route,
    // is ignored, so nobody buys a ₦450,000 sofa for one naira.
    const guest = await api('post', '/api/orders/create').send({
      items: [{ item: sofaId, quantity: 1, unitPrice: 1 }],
      shippingAddress: {
        fullName: 'Bargain Hunter',
        phone: '08030000010',
        email: anEmail(),
        address: '1 Test Road',
        city: 'Lagos',
        state: 'Lagos',
      },
      useSameAddressForBilling: true,
      paymentMethod: 'whatsapp',
    });

    expect(guest.status).toBe(201);
    expect(guest.body.order.subtotal).toBe(450000);
  });
});

describe('reading one order in the console', () => {
  it('returns it in full, with the status history the list cannot show', async () => {
    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 210000 }],
      customer: { fullName: 'Read Me' },
      deliveredNow: true,
    });

    const res = await get(`/api/orders/admin/${sale.body.order._id}`);

    expect(res.status).toBe(200);
    expect(res.body.order.orderNumber).toBe(sale.body.order.orderNumber);
    expect(res.body.order.items.length).toBe(1);

    // Placed, confirmed, delivered — the three that actually happened, in order.
    const statuses = res.body.order.statusHistory.map((event) => event.status);
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('delivered');
  });

  it('is not swallowed by the list route', async () => {
    // `/admin/all` is a literal path and `/admin/:orderId` a parameter; the
    // wrong registration order makes one of them unreachable.
    const list = await get('/api/orders/admin/all?limit=1');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.orders)).toBe(true);
  });

  it('404s an order that does not exist', async () => {
    const res = await get('/api/orders/admin/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
  });

  it('is refused without the console session', async () => {
    const sale = await post('/api/orders/admin/sales', {
      items: [{ product: sofaId, quantity: 1, unitPrice: 100000 }],
      customer: { fullName: 'Private' },
    });

    const res = await api('get', `/api/orders/admin/${sale.body.order._id}`);
    expect(res.status).toBe(401);
  });
});

describe("reading one product's stock position", () => {
  it('answers with the figures a product page needs', async () => {
    const res = await get(`/api/inventory/admin/products/${sofaId}`);

    expect(res.status).toBe(200);
    expect(res.body.product._id).toBe(sofaId);
    expect(res.body.product.name).toBe('Showroom Sofa');
    // Available is on hand less what is held for confirmed orders, and both are
    // published so the difference is visible rather than surprising.
    expect(res.body.product.onHand).toBeGreaterThanOrEqual(res.body.product.stockQuantity);
    expect(res.body.product.costPrice).toBeCloseTo(200000, 2);
  });

  it('404s a product that does not exist', async () => {
    const res = await get('/api/inventory/admin/products/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
  });

  it('does not shadow the history route beneath it', async () => {
    const res = await get(`/api/inventory/admin/products/${sofaId}/history`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.movements)).toBe(true);
    expect(res.body.movements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Correcting drafts
// ---------------------------------------------------------------------------

describe('correcting a draft expense', () => {
  const anExpense = async (overrides = {}) =>
    (
      await post('/api/purchasing/expenses', {
        vendorId,
        accountCode: '5600',
        description: 'Workshop rent',
        date: '2026-02-15',
        netAmount: 200000,
        ...overrides,
      })
    ).body.expense;

  it('changes the amount, and the total follows it', async () => {
    const expense = await anExpense();

    const fixed = await patch(`/api/purchasing/expenses/${expense._id}`, {
      netAmount: 250000,
      taxAmount: 18750,
    });

    expect(fixed.status).toBe(200);
    expect(fixed.body.expense.netAmount).toBe(250000);
    expect(fixed.body.expense.totalAmount).toBe(268750);
  });

  it('leaves untouched fields as they were', async () => {
    const expense = await anExpense({ description: 'Diesel', netAmount: 45000 });

    const fixed = await patch(`/api/purchasing/expenses/${expense._id}`, {
      description: 'Diesel for the generator',
    });

    expect(fixed.body.expense.description).toBe('Diesel for the generator');
    expect(fixed.body.expense.netAmount).toBe(45000);
    expect(fixed.body.expense.account.code).toBe('5600');
  });

  it('moves it to another account', async () => {
    const expense = await anExpense();
    const fixed = await patch(`/api/purchasing/expenses/${expense._id}`, {
      accountCode: '5700',
    });

    expect(fixed.status).toBe(200);
    expect(fixed.body.expense.account.code).toBe('5700');
  });

  it('refuses once it has been approved, because it is in the books', async () => {
    const expense = await anExpense();
    await post(`/api/purchasing/expenses/${expense._id}/approve`);

    const refused = await patch(`/api/purchasing/expenses/${expense._id}`, {
      netAmount: 1,
    });

    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/void it/i);
  });

  it('is a 404 for an expense that does not exist', async () => {
    const res = await patch('/api/purchasing/expenses/11111111-1111-1111-1111-111111111111', {
      description: 'Nothing',
    });
    expect(res.status).toBe(404);
  });
});

describe('correcting a draft purchase order', () => {
  const anOrder = async (overrides = {}) =>
    (
      await post('/api/purchasing/purchase-orders', {
        vendorId,
        items: [{ product: sofaId, quantity: 2, unitCost: 150000 }],
        ...overrides,
      })
    ).body.purchaseOrder;

  it('replaces the lines, and the total follows them', async () => {
    const order = await anOrder();

    const fixed = await patch(`/api/purchasing/purchase-orders/${order._id}`, {
      items: [{ product: sofaId, quantity: 5, unitCost: 140000 }],
    });

    expect(fixed.status).toBe(200);
    expect(fixed.body.purchaseOrder.items).toHaveLength(1);
    expect(fixed.body.purchaseOrder.items[0].quantity).toBe(5);
    expect(fixed.body.purchaseOrder.total).toBe(700000);
  });

  it('changes the date and the note without touching the lines', async () => {
    const order = await anOrder();

    const fixed = await patch(`/api/purchasing/purchase-orders/${order._id}`, {
      expectedOn: '2026-04-01',
      notes: 'Chase them',
    });

    expect(fixed.body.purchaseOrder.notes).toBe('Chase them');
    expect(fixed.body.purchaseOrder.items).toHaveLength(1);
    expect(fixed.body.purchaseOrder.total).toBe(300000);
  });

  it('refuses once it has been sent, because somebody else is acting on it', async () => {
    const order = await anOrder();
    await post(`/api/purchasing/purchase-orders/${order._id}/send`);

    const refused = await patch(`/api/purchasing/purchase-orders/${order._id}`, {
      notes: 'Too late',
    });

    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/no longer be edited/i);
  });

  it('refuses an order with no lines at all', async () => {
    const order = await anOrder();
    const refused = await patch(`/api/purchasing/purchase-orders/${order._id}`, { items: [] });
    expect(refused.status).toBe(400);
  });
});
