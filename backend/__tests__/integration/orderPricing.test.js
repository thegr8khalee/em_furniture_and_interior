import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Order from '../../src/models/order.model.js';
import Product from '../../src/models/product.model.js';
import Coupon from '../../src/models/coupon.model.js';
import {
  buildTestApp,
  connectTestDb,
  closeTestDb,
  clearCollections,
} from '../helpers/testApp.js';

/**
 * Order pricing is derived entirely server-side (findings F-05 and F-06).
 * These run against the real Express app and a real MongoDB.
 */

let app;

const address = {
  fullName: 'Ada Obi',
  phone: '+2348012345678',
  email: 'ada@example.com',
  address: '12 Awolowo Road',
  city: 'Ikoyi',
  state: 'Lagos',
  country: 'Nigeria',
  postalCode: '101233',
};

const makeProduct = (overrides = {}) =>
  Product.create({
    name: 'Panama Armchair',
    description: 'A chair.',
    items: 'Armchair',
    price: 100000,
    category: 'Living Room',
    style: 'Modern',
    images: [{ url: 'https://example.com/chair.jpg' }],
    ...overrides,
  });

const placeOrder = (body) =>
  request(app).post('/api/orders/create').send({ shippingAddress: address, ...body });

beforeAll(async () => {
  process.env.TAX_RATE_PERCENTAGE = '7.5';
  process.env.JWT_SECRET = 'test-secret';
  delete process.env.SHIPPING_FLAT_RATE;
  await connectTestDb();
  app = buildTestApp();
}, 120000);

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await clearCollections();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('server-side pricing (F-05)', () => {
  test('ignores a client-supplied taxAmount and computes its own', async () => {
    const product = await makeProduct({ price: 100000 });

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
      taxAmount: 0,          // the exploit: customer declares no tax
      shippingCost: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body.order.taxAmount).toBe(7500);      // 7.5% of 100,000
    expect(res.body.order.totalAmount).toBe(107500);
  });

  test('ignores an inflated client-supplied shippingCost', async () => {
    const product = await makeProduct({ price: 100000 });

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
      shippingCost: -50000,  // would reduce the total if trusted
      taxAmount: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body.order.shippingCost).toBe(0);
    expect(res.body.order.totalAmount).toBe(107500);
  });

  test('prices line items from the catalog, not from the request', async () => {
    const product = await makeProduct({ price: 100000 });

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 2, price: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.order.items[0].price).toBe(100000);
    expect(res.body.order.subtotal).toBe(200000);
  });

  test('prefers discountedPrice when the product has one', async () => {
    const product = await makeProduct({ price: 100000, discountedPrice: 80000 });

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
    });

    expect(res.body.order.subtotal).toBe(80000);
  });

  test('rejects an item that does not exist', async () => {
    const res = await placeOrder({
      items: [{ item: new mongoose.Types.ObjectId(), itemType: 'Product', quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('rejects a non-positive quantity', async () => {
    const product = await makeProduct();

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 0 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/quantity/i);
  });

  // The quote the customer sees must be the amount they are charged.
  test('the tax quote matches what the order is charged', async () => {
    const product = await makeProduct({ price: 100000 });

    const quote = await request(app)
      .post('/api/taxes/calculate')
      .send({ items: [{ id: product._id, quantity: 3 }] });

    const order = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 3 }],
    });

    expect(quote.status).toBe(200);
    expect(quote.body.tax.amountToCollect).toBe(order.body.order.taxAmount);
    expect(quote.body.pricing.subtotal).toBe(order.body.order.subtotal);
  });
});

describe('coupons', () => {
  const makeCoupon = (overrides = {}) =>
    Coupon.create({
      code: 'SAVE10',
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: new Date(Date.now() + 86400000),
      isActive: true,
      ...overrides,
    });

  test('applies a valid coupon and taxes the discounted amount', async () => {
    const product = await makeProduct({ price: 100000 });
    await makeCoupon();

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
      couponCode: 'save10',
    });

    expect(res.body.order.discount).toBe(10000);
    expect(res.body.order.taxAmount).toBe(6750);      // 7.5% of 90,000
    expect(res.body.order.totalAmount).toBe(96750);
  });

  // Finding F-06: usage was incremented before the order was saved.
  test('increments coupon usage only after the order is saved', async () => {
    const product = await makeProduct();
    const coupon = await makeCoupon();

    await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
      couponCode: 'SAVE10',
    });

    expect((await Coupon.findById(coupon._id)).usageCount).toBe(1);
  });

  test('does not burn a coupon use when the order is rejected', async () => {
    const coupon = await makeCoupon();

    const res = await placeOrder({
      items: [{ item: new mongoose.Types.ObjectId(), itemType: 'Product', quantity: 1 }],
      couponCode: 'SAVE10',
    });

    expect(res.status).toBe(400);
    expect((await Coupon.findById(coupon._id)).usageCount).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
  });

  test('ignores an unknown coupon code without failing the order', async () => {
    const product = await makeProduct({ price: 100000 });

    const res = await placeOrder({
      items: [{ item: product._id, itemType: 'Product', quantity: 1 }],
      couponCode: 'NOPE',
    });

    expect(res.status).toBe(201);
    expect(res.body.order.discount).toBe(0);
    expect(res.body.order.couponCode).toBeNull();
  });
});

describe('idempotency (F-06)', () => {
  test('a repeated request with the same key returns the original order', async () => {
    const product = await makeProduct();
    const items = [{ item: product._id, itemType: 'Product', quantity: 1 }];

    const first = await placeOrder({ items, idempotencyKey: 'checkout-abc' });
    const second = await placeOrder({ items, idempotencyKey: 'checkout-abc' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.order._id).toBe(first.body.order._id);
    expect(await Order.countDocuments()).toBe(1);
  });

  test('concurrent submissions with the same key create exactly one order', async () => {
    const product = await makeProduct();
    const items = [{ item: product._id, itemType: 'Product', quantity: 1 }];

    const results = await Promise.all([
      placeOrder({ items, idempotencyKey: 'race-1' }),
      placeOrder({ items, idempotencyKey: 'race-1' }),
      placeOrder({ items, idempotencyKey: 'race-1' }),
    ]);

    for (const res of results) expect([200, 201]).toContain(res.status);
    expect(await Order.countDocuments()).toBe(1);
  });

  test('different keys create separate orders', async () => {
    const product = await makeProduct();
    const items = [{ item: product._id, itemType: 'Product', quantity: 1 }];

    await placeOrder({ items, idempotencyKey: 'a' });
    await placeOrder({ items, idempotencyKey: 'b' });

    expect(await Order.countDocuments()).toBe(2);
  });

  test('omitting the key preserves the previous behaviour', async () => {
    const product = await makeProduct();
    const items = [{ item: product._id, itemType: 'Product', quantity: 1 }];

    await placeOrder({ items });
    await placeOrder({ items });

    expect(await Order.countDocuments()).toBe(2);
  });
});
