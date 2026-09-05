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
  insertCollection,
} from '../helpers/database.js';

// Reviews and moderation, over HTTP.
//
// The interesting properties are all about who may say what: only somebody who
// bought the thing may review it, only once, and an unmoderated review must not
// move the rating anyone reads.

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test-message' })),
}));

let app;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  process.env.TAX_RATE_PERCENTAGE = '7.5';
  ({ default: app } = await import('../../src/app.js'));

});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.4.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

const ADDRESS = {
  fullName: 'Ada Obi',
  phone: '08030000000',
  email: 'ada@example.com',
  address: '12 Ikoyi Crescent',
  city: 'Lagos',
  state: 'Lagos',
};

const signUp = async () => {
  const email = `shopper-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await api('post', '/api/auth/signup').send({
    fullName: 'Ada Obi',
    email,
    password: 'Password123!',
  });
  return { cookie: asCookie(res), customerId: res.body.id };
};

const signInAsOperator = async (role = 'super_admin') => {
  const { registerStaff } = await import('../../src/services/identity.js');
  const email = `ops-${Math.random().toString(36).slice(2)}@example.com`;
  await registerStaff({
    username: `ops-${Math.random().toString(36).slice(2)}`,
    email,
    password: 'Password123!',
    role,
  });
  const res = await api('post', '/api/admin/login').send({ email, password: 'Password123!' });
  return asCookie(res);
};

/** Buys the item, and takes the order as far as the given status. */
const buy = async (cookie, itemId, { status = 'confirmed' } = {}) => {
  const placed = await api('post', '/api/orders/create')
    .set('Cookie', cookie)
    .send({ shippingAddress: ADDRESS, items: [{ item: itemId, quantity: 1 }] });

  if (status !== 'pending') {
    await getDb().query(
      `UPDATE orders SET status = :status::order_status,
              delivered_at = CASE WHEN :status = 'delivered' THEN now() ELSE delivered_at END
        WHERE id = :id`,
      { replacements: { id: placed.body.order._id, status } }
    );
  }

  return placed.body.order;
};

describe('leaving a review', () => {
  let productId;

  beforeAll(async () => {
    productId = await insertProduct({ name: 'Reviewed Sofa', price: 1000000 });
  });

  it('refuses somebody who has not bought the item', async () => {
    const { cookie } = await signUp();

    const res = await api('post', `/api/review/products/${productId}`)
      .set('Cookie', cookie)
      .send({ rating: 5, comment: 'Lovely' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verified purchasers/i);
  });

  it('refuses somebody whose order is still pending', async () => {
    const { cookie } = await signUp();
    await buy(cookie, productId, { status: 'pending' });

    const res = await api('post', `/api/review/products/${productId}`)
      .set('Cookie', cookie)
      .send({ rating: 5 });

    expect(res.status).toBe(403);
  });

  it('accepts a review from a buyer, unapproved and marked verified', async () => {
    const { cookie } = await signUp();
    await buy(cookie, productId);

    const res = await api('post', `/api/review/products/${productId}`)
      .set('Cookie', cookie)
      .send({ rating: 4, comment: 'Very comfortable' });

    expect(res.status).toBe(201);
    expect(res.body.review).toMatchObject({
      rating: 4,
      comment: 'Very comfortable',
      isVerifiedPurchase: true,
      isApproved: false,
    });
  });

  it('does not move the rating until the review is approved', async () => {
    const item = await insertProduct({ name: 'Rating Sofa', price: 1000000 });
    const { cookie } = await signUp();
    await buy(cookie, item);

    const posted = await api('post', `/api/review/products/${item}`)
      .set('Cookie', cookie)
      .send({ rating: 1 });

    expect(posted.body.averageRating).toBe(0);

    const listed = await api('get', `/api/products/${item}`);
    expect(listed.body.averageRating ?? listed.body.product?.averageRating ?? 0).toBe(0);
  });

  it('allows one review per buyer per item', async () => {
    const { cookie } = await signUp();
    await buy(cookie, productId);

    const first = await api('post', `/api/review/products/${productId}`)
      .set('Cookie', cookie)
      .send({ rating: 5 });
    const second = await api('post', `/api/review/products/${productId}`)
      .set('Cookie', cookie)
      .send({ rating: 1 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already reviewed/i);
  });

  it('refuses a rating outside one to five, and a rating that is not a whole number', async () => {
    const { cookie } = await signUp();
    await buy(cookie, productId);

    for (const rating of [0, 6, 4.5, undefined]) {
      const res = await api('post', `/api/review/products/${productId}`)
        .set('Cookie', cookie)
        .send({ rating });

      expect(res.status).toBe(400);
    }
  });

  it('requires a session', async () => {
    const res = await api('post', `/api/review/products/${productId}`).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  it('reviews a collection the same way', async () => {
    const setId = await insertCollection({ name: 'Reviewed Set', price: 5000000 });
    const { cookie } = await signUp();
    await buy(cookie, setId);

    const res = await api('post', `/api/review/collections/${setId}`)
      .set('Cookie', cookie)
      .send({ rating: 5 });

    expect(res.status).toBe(201);
  });

  it('will not accept a collection review through the product route', async () => {
    const setId = await insertCollection({ name: 'Wrong Route Set', price: 5000000 });
    const { cookie } = await signUp();
    await buy(cookie, setId);

    const res = await api('post', `/api/review/products/${setId}`)
      .set('Cookie', cookie)
      .send({ rating: 5 });

    expect(res.status).toBe(404);
  });
});

describe('moderating reviews', () => {
  let adminCookie;
  let productId;

  beforeAll(async () => {
    adminCookie = await signInAsOperator();
    productId = await insertProduct({ name: 'Moderated Sofa', price: 1000000 });
  });

  const aReview = async (itemId, rating = 5) => {
    const { cookie } = await signUp();
    await buy(cookie, itemId);
    const res = await api('post', `/api/review/products/${itemId}`)
      .set('Cookie', cookie)
      .send({ rating });
    return res.body.review;
  };

  it('lists what is waiting, with the item and the reviewer', async () => {
    const review = await aReview(productId);

    const res = await api('get', '/api/review/admin/pending/products').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const waiting = res.body.pending.find((entry) => entry.review._id === review._id);
    expect(waiting).toMatchObject({ type: 'Product', parentName: 'Moderated Sofa' });
    expect(waiting.review.userId.username).toBe('Ada Obi');
  });

  it('does not list a collection review among the product ones', async () => {
    const setId = await insertCollection({ name: 'Pending Set', price: 5000000 });
    const { cookie } = await signUp();
    await buy(cookie, setId);
    await api('post', `/api/review/collections/${setId}`).set('Cookie', cookie).send({ rating: 5 });

    const products = await api('get', '/api/review/admin/pending/products').set('Cookie', adminCookie);
    const collections = await api('get', '/api/review/admin/pending/collections').set(
      'Cookie',
      adminCookie
    );

    expect(products.body.pending.every((e) => e.type === 'Product')).toBe(true);
    expect(collections.body.pending.some((e) => e.parentName === 'Pending Set')).toBe(true);
  });

  it('approving records who approved it and when, and moves the rating', async () => {
    const item = await insertProduct({ name: 'Approved Sofa', price: 1000000 });
    const review = await aReview(item, 4);

    const res = await api(
      'patch',
      `/api/review/admin/products/${item}/reviews/${review._id}/approve`
    ).set('Cookie', adminCookie);

    expect(res.status).toBe(200);

    const [stored] = await rows(
      'SELECT is_approved, approved_at, approved_by FROM reviews WHERE id = :id',
      { id: review._id }
    );
    expect(stored.is_approved).toBe(true);
    expect(stored.approved_at).not.toBeNull();
    expect(stored.approved_by).not.toBeNull();

    const [item_] = await rows(
      'SELECT average_rating, review_count FROM sellable_items WHERE id = :id',
      { id: item }
    );
    expect(Number(item_.average_rating)).toBe(4);
    expect(item_.review_count).toBe(1);
  });

  it('rejecting removes the review and takes the rating back down', async () => {
    const item = await insertProduct({ name: 'Rejected Sofa', price: 1000000 });
    const review = await aReview(item, 5);
    await api('patch', `/api/review/admin/products/${item}/reviews/${review._id}/approve`).set(
      'Cookie',
      adminCookie
    );

    const res = await api('delete', `/api/review/admin/products/${item}/reviews/${review._id}`).set(
      'Cookie',
      adminCookie
    );
    const again = await api(
      'delete',
      `/api/review/admin/products/${item}/reviews/${review._id}`
    ).set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(again.status).toBe(404);

    const [item_] = await rows(
      'SELECT average_rating, review_count FROM sellable_items WHERE id = :id',
      { id: item }
    );
    expect(Number(item_.average_rating)).toBe(0);
    expect(item_.review_count).toBe(0);
  });

  it('refuses an operator without the reviews permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/review/admin/pending/products').set('Cookie', editor);

    expect(res.status).toBe(403);
  });

  it('publishes an approved review with the item, and keeps an unapproved one out', async () => {
    const item = await insertProduct({ name: 'Published Sofa', price: 1000000 });
    const shown = await aReview(item, 5);
    await aReview(item, 1); // left unapproved

    await api('patch', `/api/review/admin/products/${item}/reviews/${shown._id}/approve`).set(
      'Cookie',
      adminCookie
    );

    const res = await api('get', `/api/products/${item}`);
    const product = res.body.product ?? res.body;

    expect(product.reviews).toHaveLength(1);
    expect(product.reviews[0]._id).toBe(shown._id);
    expect(product.reviews[0].userId.username).toBe('Ada Obi');
  });
});
