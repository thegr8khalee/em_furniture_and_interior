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

// Where the stock is, whether it is really there, and what to buy next.
//
// The three assertions that matter here are all about stock not being able to
// go missing between the lines: a transfer that moves out of one place and into
// nowhere, a count that writes off everything nobody got round to counting, and
// an adjustment that changes the shelf without changing the books.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;
let adminCookie;
let defaultLocationId;
let containerId;
let deskId;

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.80.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const get = (path) => api('get', path).set('Cookie', adminCookie);
const post = (path, body = {}) => api('post', path).set('Cookie', adminCookie).send(body);
const patch = (path, body = {}) => api('patch', path).set('Cookie', adminCookie).send(body);
const put = (path, body = {}) => api('put', path).set('Cookie', adminCookie).send(body);

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `wh-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `wh-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
}

/** Stock into a named place. The default-location trigger fills in the rest. */
const stockInto = async (productId, quantity, locationId) => {
  const [row] = await rows(
    `INSERT INTO stock_movements (product_id, quantity, reason, location_id, unit_cost)
     VALUES (:productId, :quantity, 'purchase_receipt', :locationId, 1000000)
     RETURNING id`,
    { productId, quantity, locationId }
  );
  return row.id;
};

const onHandAt = async (productId, locationId) => {
  const [row] = await rows(
    `SELECT COALESCE(SUM(quantity), 0)::int AS held
       FROM stock_movements WHERE product_id = :productId AND location_id = :locationId`,
    { productId, locationId }
  );
  return row.held;
};

const balanceOf = async (code) => {
  const res = await get('/api/books/trial-balance');
  return res.body.accounts.find((a) => a.code === code)?.balance ?? 0;
};

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();

  const [row] = await rows('SELECT id FROM stock_locations WHERE is_default LIMIT 1');
  defaultLocationId = row.id;

  const container = await post('/api/warehouse/locations', {
    name: 'Container at the port',
    address: 'Apapa',
    // Nothing here can be sold today; it is not on any shelf.
    isSellable: false,
  });
  containerId = container.body.location._id;

  deskId = await insertProduct({
    name: 'Warehouse Desk',
    price: 12000000,
    cost_price: 5000000,
    sku: 'WH-DESK',
  });
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

// ---------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------

describe('locations', () => {
  it('ships with one default place, so stock has somewhere to be', async () => {
    const res = await get('/api/warehouse/locations');

    expect(res.status).toBe(200);
    expect(res.body.locations.filter((row) => row.isDefault)).toHaveLength(1);
  });

  it('creates one, sellable unless told otherwise', async () => {
    const shop = await post('/api/warehouse/locations', { name: `Showroom ${Date.now()}` });

    expect(shop.status).toBe(201);
    expect(shop.body.location.isSellable).toBe(true);
    expect(shop.body.location.isDefault).toBe(false);
  });

  it('refuses a second place with the same name', async () => {
    const name = `Twice ${Date.now()}`;
    await post('/api/warehouse/locations', { name });

    const again = await post('/api/warehouse/locations', { name });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already a location/i);
  });

  it('needs a name', async () => {
    expect((await post('/api/warehouse/locations', { address: 'Nowhere' })).status).toBe(400);
  });

  it('renames one and closes it', async () => {
    const made = await post('/api/warehouse/locations', { name: `Old name ${Date.now()}` });

    const changed = await patch(`/api/warehouse/locations/${made.body.location._id}`, {
      name: `New name ${Date.now()}`,
      isActive: false,
    });

    expect(changed.status).toBe(200);
    expect(changed.body.location.isActive).toBe(false);
  });

  it('404s a location that does not exist', async () => {
    const res = await patch('/api/warehouse/locations/11111111-1111-1111-1111-111111111111', {
      name: 'Ghost',
    });
    expect(res.status).toBe(404);
  });

  it('reports what is where', async () => {
    await stockInto(deskId, 6, containerId);

    const res = await get(`/api/warehouse/stock?location=${containerId}`);
    expect(res.status).toBe(200);

    const line = res.body.stock.find((row) => row.product._id === deskId);
    expect(line.onHand).toBe(6);
    expect(line.location.isSellable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Moving it
// ---------------------------------------------------------------------------

describe('transfers', () => {
  it('takes it out of one place and puts it in the other, together', async () => {
    const chair = await insertProduct({ name: 'Moved Chair', cost_price: 400000, sku: 'WH-MOVE' });
    await stockInto(chair, 10, containerId);

    const res = await post('/api/warehouse/transfers', {
      product: chair,
      from: containerId,
      to: defaultLocationId,
      quantity: 4,
    });

    expect(res.status).toBe(201);
    expect(await onHandAt(chair, containerId)).toBe(6);
    expect(await onHandAt(chair, defaultLocationId)).toBe(4);
  });

  it('writes the two movements under one group, so they cannot be read apart', async () => {
    const lamp = await insertProduct({ name: 'Moved Lamp', cost_price: 100000, sku: 'WH-LAMP' });
    await stockInto(lamp, 5, containerId);

    const res = await post('/api/warehouse/transfers', {
      product: lamp,
      from: containerId,
      to: defaultLocationId,
      quantity: 2,
    });

    const pair = await rows(
      `SELECT reason::text, quantity, location_id FROM stock_movements
        WHERE transfer_group = :group ORDER BY quantity`,
      { group: res.body.transferGroup }
    );

    expect(pair).toHaveLength(2);
    expect(pair[0].reason).toBe('transfer_out');
    expect(Number(pair[0].quantity)).toBe(-2);
    expect(pair[1].reason).toBe('transfer_in');
    expect(Number(pair[1].quantity)).toBe(2);
  });

  it('posts nothing, because the value did not change', async () => {
    const stool = await insertProduct({ name: 'Moved Stool', cost_price: 200000, sku: 'WH-STOOL' });
    await stockInto(stool, 3, containerId);

    const before = await balanceOf('1300');

    await post('/api/warehouse/transfers', {
      product: stool,
      from: containerId,
      to: defaultLocationId,
      quantity: 3,
    });

    // Only its address changed.
    expect(await balanceOf('1300')).toBeCloseTo(before, 2);
  });

  it('refuses to move more than is there', async () => {
    const rug = await insertProduct({ name: 'Scarce Rug', cost_price: 90000, sku: 'WH-RUG' });
    await stockInto(rug, 2, containerId);

    const res = await post('/api/warehouse/transfers', {
      product: rug,
      from: containerId,
      to: defaultLocationId,
      quantity: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only 2 there/i);
    expect(await onHandAt(rug, containerId)).toBe(2);
  });

  it('refuses a move to the same place', async () => {
    const res = await post('/api/warehouse/transfers', {
      product: deskId,
      from: containerId,
      to: containerId,
      quantity: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/same place/i);
  });

  it('refuses a fraction of a desk', async () => {
    const res = await post('/api/warehouse/transfers', {
      product: deskId,
      from: containerId,
      to: defaultLocationId,
      quantity: 1.5,
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Counting it
// ---------------------------------------------------------------------------

describe('a stock take', () => {
  let takeId;
  let countedProduct;

  it('opens a sheet holding what the books say is there', async () => {
    countedProduct = await insertProduct({
      name: 'Counted Cabinet',
      cost_price: 1000000, // ₦10,000 each
      sku: 'WH-COUNT',
    });

    const room = await post('/api/warehouse/locations', { name: `Back room ${Date.now()}` });
    const roomId = room.body.location._id;

    await stockInto(countedProduct, 12, roomId);

    const started = await post('/api/warehouse/stock-takes', {
      location: roomId,
      notes: 'Year end',
    });

    expect(started.status).toBe(201);
    expect(started.body.stockTake.status).toBe('counting');

    const line = started.body.stockTake.lines.find((row) => row.product._id === countedProduct);
    expect(line.expected).toBe(12);
    // Frozen as the sheet was drawn up, and not yet counted.
    expect(line.counted).toBeNull();

    takeId = started.body.stockTake._id;
  });

  it('refuses a second open count for the same place', async () => {
    const [take] = await rows('SELECT location_id FROM stock_takes WHERE id = :id', { id: takeId });

    const again = await post('/api/warehouse/stock-takes', { location: take.location_id });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already a count open/i);
  });

  it('records what was actually on the shelf, and works out the variance', async () => {
    const res = await put(`/api/warehouse/stock-takes/${takeId}/counts`, {
      counts: [{ productId: countedProduct, counted: 9, note: 'Two damaged, one gone' }],
    });

    expect(res.status).toBe(200);

    const line = res.body.stockTake.lines.find((row) => row.product._id === countedProduct);
    expect(line.counted).toBe(9);
    expect(line.variance).toBe(-3);
    // What the difference is worth is what the write-off will cost.
    expect(line.varianceValue).toBeCloseTo(-30000, 2);
  });

  it('refuses a count that is not a whole number, or is negative', async () => {
    for (const counted of [2.5, -1]) {
      const res = await put(`/api/warehouse/stock-takes/${takeId}/counts`, {
        counts: [{ productId: countedProduct, counted }],
      });
      expect(res.status).toBe(400);
    }
  });

  it('applies the difference as one adjustment, and posts it', async () => {
    const writeOffsBefore = await balanceOf('5400');
    const stockBefore = await balanceOf('1300');

    const applied = await post(`/api/warehouse/stock-takes/${takeId}/apply`);

    expect(applied.status).toBe(200);
    expect(applied.body.stockTake.status).toBe('applied');
    expect(applied.body.message).toMatch(/lost 3 items/i);

    const movements = await rows(
      `SELECT quantity, reason::text, note FROM stock_movements
        WHERE product_id = :id AND reason = 'adjustment'`,
      { id: countedProduct }
    );

    expect(movements).toHaveLength(1);
    expect(Number(movements[0].quantity)).toBe(-3);
    // A year later the log still says these were one stock take.
    expect(movements[0].note).toMatch(/stock take/i);

    // Three cabinets at ₦10,000 left the building without being sold.
    expect(await balanceOf('5400')).toBeCloseTo(writeOffsBefore + 30000, 2);
    expect(await balanceOf('1300')).toBeCloseTo(stockBefore - 30000, 2);
  });

  it('leaves an uncounted line alone rather than writing it off', async () => {
    // Treating "nobody got to it" as zero would write off the whole shelf.
    const seen = await insertProduct({ name: 'Seen Sofa', cost_price: 500000, sku: 'WH-SEEN' });
    const missed = await insertProduct({ name: 'Missed Mirror', cost_price: 500000, sku: 'WH-MISS' });

    const room = await post('/api/warehouse/locations', { name: `Half counted ${Date.now()}` });
    const roomId = room.body.location._id;

    await stockInto(seen, 4, roomId);
    await stockInto(missed, 7, roomId);

    const started = await post('/api/warehouse/stock-takes', { location: roomId });
    const id = started.body.stockTake._id;

    await put(`/api/warehouse/stock-takes/${id}/counts`, {
      counts: [{ productId: seen, counted: 3 }],
    });

    await post(`/api/warehouse/stock-takes/${id}/apply`);

    expect(await onHandAt(seen, roomId)).toBe(3);
    expect(await onHandAt(missed, roomId)).toBe(7);
  });

  it('will not apply a count twice', async () => {
    const again = await post(`/api/warehouse/stock-takes/${takeId}/apply`);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already applied/i);
  });

  it('will not take counts against a count that is finished', async () => {
    const res = await put(`/api/warehouse/stock-takes/${takeId}/counts`, {
      counts: [{ productId: countedProduct, counted: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('abandons an open count, changing nothing', async () => {
    const item = await insertProduct({ name: 'Abandoned Bench', cost_price: 300000, sku: 'WH-ABND' });
    const room = await post('/api/warehouse/locations', { name: `Abandoned ${Date.now()}` });
    const roomId = room.body.location._id;

    await stockInto(item, 5, roomId);

    const started = await post('/api/warehouse/stock-takes', { location: roomId });
    const id = started.body.stockTake._id;

    await put(`/api/warehouse/stock-takes/${id}/counts`, {
      counts: [{ productId: item, counted: 1 }],
    });

    const abandoned = await post(`/api/warehouse/stock-takes/${id}/abandon`);

    expect(abandoned.status).toBe(200);
    expect(abandoned.body.stockTake.status).toBe('abandoned');
    expect(await onHandAt(item, roomId)).toBe(5);
  });

  it('will not abandon one that has been applied', async () => {
    const res = await post(`/api/warehouse/stock-takes/${takeId}/abandon`);
    expect(res.status).toBe(400);
  });

  it('lists them, most recent first', async () => {
    const res = await get('/api/warehouse/stock-takes');

    expect(res.status).toBe(200);
    expect(res.body.stockTakes.length).toBeGreaterThan(0);
    expect(res.body.stockTakes.some((row) => row._id === takeId)).toBe(true);
  });

  it('404s a count that does not exist', async () => {
    const res = await get('/api/warehouse/stock-takes/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// What to buy
// ---------------------------------------------------------------------------

describe('what to reorder', () => {
  it('calls something late when it will run out before more could arrive', async () => {
    const fast = await insertProduct({
      name: 'Fast Moving Chair',
      price: 3000000,
      cost_price: 1000000,
      sku: 'WH-FAST',
    });

    // Twenty-one days to restock, and a buffer of five.
    await rows(
      `UPDATE products SET low_stock_threshold = 5, lead_time_days = 21 WHERE id = :id`,
      { id: fast }
    );

    await stockInto(fast, 100, defaultLocationId);

    // Ninety-six sold inside the window: about one a day, with four left. Real
    // sales rather than invented movements, because `stock_sale_names_its_order`
    // refuses a sale that belongs to no order — which is the constraint that
    // makes the reorder figures trustworthy in the first place.
    await post('/api/orders/admin/sales', {
      items: [{ product: fast, quantity: 96, unitPrice: 30000 }],
      customer: { fullName: 'Bought The Lot' },
    });

    const res = await get('/api/warehouse/reorder?days=90');
    expect(res.status).toBe(200);

    const line = res.body.suggestions.find((row) => row.product._id === fast);
    expect(line).toBeDefined();
    expect(line.available).toBe(4);
    expect(line.urgency).toBe('late');
    expect(line.suggestedQuantity).toBeGreaterThan(0);
    expect(line.estimatedCost).toBeGreaterThan(0);
  });

  it('does not ask for more of something a supplier is already bringing', async () => {
    const onOrder = await insertProduct({
      name: 'Already Ordered Table',
      price: 4000000,
      cost_price: 2000000,
      sku: 'WH-ONORDER',
    });

    await rows(`UPDATE products SET low_stock_threshold = 10, lead_time_days = 14 WHERE id = :id`, {
      id: onOrder,
    });
    await stockInto(onOrder, 1, defaultLocationId);

    const before = await get('/api/warehouse/reorder?days=90');
    const asked = before.body.suggestions.find((row) => row.product._id === onOrder);

    const vendor = await post('/api/purchasing/vendors', { name: `Incoming ${Date.now()}` });
    await post('/api/purchasing/purchase-orders', {
      vendorId: vendor.body.vendor._id,
      items: [{ product: onOrder, quantity: 50, unitCost: 20000 }],
    });

    const after = await get('/api/warehouse/reorder?days=90');
    const now = after.body.suggestions.find((row) => row.product._id === onOrder);

    // Ordering again because the first order has not arrived is how a shop ends
    // up with a year of stock and no cash.
    expect(asked?.suggestedQuantity ?? 0).toBeGreaterThan(0);
    expect(now?.suggestedQuantity ?? 0).toBe(0);
  });

  it('leaves out what nobody is asking for and nothing needs', async () => {
    const res = await get('/api/warehouse/reorder?days=90');

    for (const line of res.body.suggestions) {
      expect(line.suggestedQuantity > 0 || line.urgency === 'late').toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Who may do it
// ---------------------------------------------------------------------------

describe('permissions', () => {
  it('is all inventory work, so support cannot touch any of it', async () => {
    const supportCookie = await signInAsOperator('support');

    const read = await api('get', '/api/warehouse/locations').set('Cookie', supportCookie);
    expect(read.status).toBe(403);
  });

  it('keeps it behind the console door', async () => {
    expect((await api('get', '/api/warehouse/locations')).status).toBe(401);
  });
});
