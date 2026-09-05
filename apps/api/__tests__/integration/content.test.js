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

// Blog posts, FAQs, portfolio projects and the marketing tables.
//
// The site's own content. What is worth protecting here is mostly about
// publication: a published post has a date, a draft is not readable by the
// public, and "showing right now" means the same thing to the storefront as it
// does to the console.

jest.unstable_mockModule('../../src/services/imageStore.js', () => ({
  cloudinaryStore: {
    upload: jest.fn(async (_data, folder) => ({
      url: `https://cdn.test/${folder}/${Math.random().toString(36).slice(2)}.png`,
      publicId: `pid-${Math.random().toString(36).slice(2)}`,
    })),
    destroy: jest.fn(async () => {}),
  },
  destroyQuietly: jest.fn(async () => {}),
}));

let app;
let adminCookie;

beforeAll(async () => {
  await setupDatabase();
  process.env.DATABASE_URL = currentDatabaseUrl();
  process.env.JWT_SECRET = 'test';
  ({ default: app } = await import('../../src/app.js'));

  adminCookie = await signInAsOperator();
});

afterAll(async () => {
  await closeSequelize();
  await teardownDatabase();
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.7.${(callers >> 8) & 255}.${callers++ & 255}`);

const asCookie = (res) =>
  [(res.headers['set-cookie'] || []).find((c) => c.startsWith('jwt=')).split(';')[0]];

const rows = (sql, replacements = {}) =>
  getDb().query(sql, { replacements, type: QueryTypes.SELECT });

async function signInAsOperator(role = 'super_admin') {
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
}

describe('the blog', () => {
  const write = (body) => api('post', '/api/admin/blog').set('Cookie', adminCookie).send(body);

  it('publishes a post with a slug and a publication date', async () => {
    const res = await write({
      title: 'Choosing the Right Sofa',
      content: 'Start with room measurements.',
      excerpt: 'A quick guide.',
      tags: ['Living Room', 'Sofa'],
      status: 'published',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slug: 'choosing-the-right-sofa',
      status: 'published',
      tags: ['Living Room', 'Sofa'],
    });
    expect(res.body.publishedAt).not.toBeNull();
    expect(res.body.author).not.toBeNull();
  });

  it('gives a second post with the same title a slug of its own', async () => {
    await write({ title: 'Same Title', content: 'One', status: 'published' });
    const second = await write({ title: 'Same Title', content: 'Two', status: 'published' });

    expect(second.body.slug).toBe('same-title-1');
  });

  it('keeps a draft out of the public list and off its own page', async () => {
    const draft = await write({ title: 'Not Ready Yet', content: 'Half a thought' });

    expect(draft.body.status).toBe('draft');
    expect(draft.body.publishedAt).toBeNull();

    const list = await api('get', '/api/blog');
    const page = await api('get', `/api/blog/${draft.body.slug}`);

    expect(list.body.items.some((post) => post._id === draft.body._id)).toBe(false);
    expect(page.status).toBe(404);
  });

  it('dates a post when it is published, and clears the date when it goes back to draft', async () => {
    const created = await write({ title: 'Later', content: 'Words' });

    const published = await api('put', `/api/admin/blog/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'published' });
    expect(published.body.publishedAt).not.toBeNull();

    const withdrawn = await api('put', `/api/admin/blog/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'draft' });
    expect(withdrawn.body.publishedAt).toBeNull();
  });

  it('re-slugs a post that is retitled, and leaves the slug alone otherwise', async () => {
    const created = await write({ title: 'Original Title', content: 'Words' });

    const retitled = await api('put', `/api/admin/blog/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'A Different Title' });
    expect(retitled.body.slug).toBe('a-different-title');

    const edited = await api('put', `/api/admin/blog/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ excerpt: 'Now with an excerpt' });
    expect(edited.body.slug).toBe('a-different-title');
  });

  it('needs a title and content', async () => {
    expect((await write({ content: 'No title' })).status).toBe(400);
    expect((await write({ title: 'No content' })).status).toBe(400);
  });

  it('deletes a post, and 404s for one already gone', async () => {
    const created = await write({ title: 'Temporary', content: 'Words' });

    const first = await api('delete', `/api/admin/blog/${created.body._id}`).set(
      'Cookie',
      adminCookie
    );
    const second = await api('delete', `/api/admin/blog/${created.body._id}`).set(
      'Cookie',
      adminCookie
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });

  it('is closed to an operator without the blog permission', async () => {
    const support = await signInAsOperator('support');

    const res = await api('post', '/api/admin/blog')
      .set('Cookie', support)
      .send({ title: 'Nope', content: 'Nope' });

    expect(res.status).toBe(403);
  });
});

describe('FAQs', () => {
  const write = (body) => api('post', '/api/admin/faqs').set('Cookie', adminCookie).send(body);

  it('publishes active FAQs in their given order', async () => {
    await write({ question: 'Second?', answer: 'Yes', order: 2 });
    await write({ question: 'First?', answer: 'Yes', order: 1 });

    const res = await api('get', '/api/faqs');

    const questions = res.body.map((faq) => faq.question);
    expect(questions.indexOf('First?')).toBeLessThan(questions.indexOf('Second?'));
  });

  it('hides an inactive FAQ from the public list but not from the console', async () => {
    const created = await write({ question: 'Retired?', answer: 'Yes', isActive: false });

    const publicList = await api('get', '/api/faqs');
    const adminList = await api('get', '/api/admin/faqs').set('Cookie', adminCookie);

    expect(publicList.body.some((faq) => faq._id === created.body._id)).toBe(false);
    expect(adminList.body.some((faq) => faq._id === created.body._id)).toBe(true);
  });

  it('needs both a question and an answer', async () => {
    expect((await write({ question: 'Only a question?' })).status).toBe(400);
    expect((await write({ answer: 'Only an answer' })).status).toBe(400);
  });

  it('edits and deletes', async () => {
    const created = await write({ question: 'Editable?', answer: 'Yes' });

    const edited = await api('put', `/api/admin/faqs/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ answer: 'Very much so' });
    expect(edited.body.answer).toBe('Very much so');

    const removed = await api('delete', `/api/admin/faqs/${created.body._id}`).set(
      'Cookie',
      adminCookie
    );
    expect(removed.status).toBe(200);
  });
});

describe('portfolio projects', () => {
  const write = (body) =>
    api('post', '/api/admin/operations/addProject').set('Cookie', adminCookie).send(body);

  const aProject = (overrides = {}) => ({
    title: 'Ikoyi Duplex',
    description: 'A full refit.',
    category: 'Residential',
    location: 'Lagos',
    price: 2500000,
    images: ['data:image/png;base64,AAAA'],
    ...overrides,
  });

  it('stores the price in kobo and publishes it in naira', async () => {
    const res = await write(aProject());

    expect(res.status).toBe(201);
    expect(res.body.price).toBe(2500000);

    const [row] = await rows('SELECT price FROM projects WHERE id = :id', { id: res.body._id });
    expect(Number(row.price)).toBe(250000000);
  });

  it('keeps the gallery in the order it was given', async () => {
    const res = await write(
      aProject({
        images: ['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'],
      })
    );

    const [positions] = await rows(
      `SELECT array_agg(position ORDER BY position) AS list
         FROM project_images WHERE project_id = :id`,
      { id: res.body._id }
    );
    expect(positions.list).toEqual([0, 1]);
    expect(res.body.images).toHaveLength(2);
  });

  it('needs at least one image, and every other field', async () => {
    expect((await write(aProject({ images: [] }))).status).toBe(400);
    expect((await write(aProject({ title: undefined }))).status).toBe(400);
    expect((await write(aProject({ price: -1 }))).status).toBe(400);
  });

  it('lists, counts and reads back one project', async () => {
    const created = await write(aProject({ title: 'Lekki Apartment' }));

    const list = await api('get', '/api/projects?limit=100');
    const count = await api('get', '/api/projects/count');
    const one = await api('get', `/api/projects/get/${created.body._id}`);

    expect(list.body.data.some((project) => project._id === created.body._id)).toBe(true);
    expect(count.body.count).toBeGreaterThan(0);
    expect(one.body.title).toBe('Lekki Apartment');
  });

  it('404s for a project id that is not an id', async () => {
    const res = await api('get', '/api/projects/get/not-a-uuid');

    expect(res.status).toBe(404);
  });

  it('replaces the gallery on update and deletes with its images', async () => {
    const created = await write(aProject());

    const updated = await api('put', `/api/admin/operations/updateProject/${created.body._id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'Renamed', images: ['data:image/png;base64,CCCC'] });
    expect(updated.body.title).toBe('Renamed');
    expect(updated.body.images).toHaveLength(1);

    const removed = await api('delete', `/api/admin/operations/delProject/${created.body._id}`).set(
      'Cookie',
      adminCookie
    );
    expect(removed.status).toBe(200);

    const [images] = await rows(
      'SELECT count(*)::int AS total FROM project_images WHERE project_id = :id',
      { id: created.body._id }
    );
    expect(images.total).toBe(0);
  });
});

describe('banners and flash sales', () => {
  const banner = (body) =>
    api('post', '/api/marketing/admin/banners').set('Cookie', adminCookie).send(body);

  const sale = (body) =>
    api('post', '/api/marketing/admin/flash-sales').set('Cookie', adminCookie).send(body);

  const hour = 60 * 60 * 1000;

  it('shows a banner that is live and hides one that is not', async () => {
    const live = await banner({
      title: 'Live now',
      imageUrl: 'https://cdn.test/live.png',
      startDate: new Date(Date.now() - hour),
      endDate: new Date(Date.now() + hour),
    });
    const future = await banner({
      title: 'Not yet',
      imageUrl: 'https://cdn.test/future.png',
      startDate: new Date(Date.now() + hour),
      endDate: new Date(Date.now() + 2 * hour),
    });
    const expired = await banner({
      title: 'Over',
      imageUrl: 'https://cdn.test/expired.png',
      startDate: new Date(Date.now() - 2 * hour),
      endDate: new Date(Date.now() - hour),
    });
    const inactive = await banner({
      title: 'Switched off',
      imageUrl: 'https://cdn.test/off.png',
      isActive: false,
    });

    const res = await api('get', '/api/marketing/banners/active');
    const shown = res.body.banners.map((b) => b._id);

    expect(shown).toContain(live.body.banner._id);
    expect(shown).not.toContain(future.body.banner._id);
    expect(shown).not.toContain(expired.body.banner._id);
    expect(shown).not.toContain(inactive.body.banner._id);
  });

  it('refuses a banner that ends before it starts', async () => {
    const res = await banner({
      title: 'Backwards',
      imageUrl: 'https://cdn.test/x.png',
      startDate: new Date(Date.now() + hour),
      endDate: new Date(Date.now() - hour),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/before it starts/i);
  });

  it('needs a title and an image', async () => {
    expect((await banner({ title: 'No image' })).status).toBe(400);
    expect((await banner({ imageUrl: 'https://cdn.test/x.png' })).status).toBe(400);
  });

  it('targets a flash sale at products and collections through one table', async () => {
    const productId = await insertProduct({ name: 'Sale Sofa', price: 100000 });
    const collectionId = await insertCollection({ name: 'Sale Set', price: 500000 });

    const res = await sale({
      name: 'Weekend Blitz',
      discountType: 'percentage',
      discountValue: 15,
      productIds: [productId],
      collectionIds: [collectionId],
      startDate: new Date(Date.now() - hour),
      endDate: new Date(Date.now() + hour),
    });

    expect(res.status).toBe(201);
    expect(res.body.flashSale.discountValue).toBe(15);
    expect(res.body.flashSale.productIds).toEqual([productId]);
    expect(res.body.flashSale.collectionIds).toEqual([collectionId]);

    const [stored] = await rows('SELECT discount_value FROM flash_sales WHERE id = :id', {
      id: res.body.flashSale._id,
    });
    expect(Number(stored.discount_value)).toBe(1500); // basis points
  });

  it('drops a target that names nothing rather than refusing the sale', async () => {
    const productId = await insertProduct({ name: 'Real Sofa', price: 100000 });

    const res = await sale({
      name: 'Half real',
      discountType: 'fixed',
      discountValue: 5000,
      productIds: [productId, '11111111-1111-4111-8111-111111111111'],
      startDate: new Date(),
      endDate: new Date(Date.now() + hour),
    });

    expect(res.status).toBe(201);
    expect(res.body.flashSale.productIds).toEqual([productId]);
  });

  it('refuses a percentage above 100 and a window that runs backwards', async () => {
    const tooMuch = await sale({
      name: 'Free stuff',
      discountType: 'percentage',
      discountValue: 150,
      startDate: new Date(),
      endDate: new Date(Date.now() + hour),
    });
    const backwards = await sale({
      name: 'Backwards',
      discountType: 'fixed',
      discountValue: 100,
      startDate: new Date(Date.now() + hour),
      endDate: new Date(),
    });

    expect(tooMuch.status).toBe(400);
    expect(backwards.status).toBe(400);
  });

  it('changes the targets on update without touching the rest', async () => {
    const first = await insertProduct({ name: 'First Sofa', price: 100000 });
    const second = await insertProduct({ name: 'Second Sofa', price: 100000 });

    const created = await sale({
      name: 'Retargeted',
      discountType: 'fixed',
      discountValue: 1000,
      productIds: [first],
      startDate: new Date(),
      endDate: new Date(Date.now() + hour),
    });

    const updated = await api(
      'put',
      `/api/marketing/admin/flash-sales/${created.body.flashSale._id}`
    )
      .set('Cookie', adminCookie)
      .send({ productIds: [second] });

    expect(updated.body.flashSale.productIds).toEqual([second]);
    expect(updated.body.flashSale.discountValue).toBe(1000);
  });

  it('is closed to an operator without the marketing permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/marketing/admin/banners').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});
