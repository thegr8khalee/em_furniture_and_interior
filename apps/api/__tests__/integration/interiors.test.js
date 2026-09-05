import { jest } from '@jest/globals';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { closeSequelize } from '../../src/db/sequelize.js';
import {
  setupDatabase,
  teardownDatabase,
  getDb,
  currentDatabaseUrl,
} from '../helpers/database.js';

// Designers and consultations.
//
// The state worth making impossible is a consultation marked "scheduled" with
// no time and nobody assigned: it looks booked on every screen and is in
// nobody's diary. Several tests here exist only to prove the database refuses
// it, whichever way a caller arrives at it.

const sent = [];

jest.unstable_mockModule('../../src/services/gmail.service.js', () => ({
  sendEmail: jest.fn(async (message) => {
    sent.push(message);
    return { id: 'test-message' };
  }),
}));

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

beforeEach(() => {
  sent.length = 0;
});

let callers = 0;
const api = (method, path) =>
  request(app)[method](path).set('X-Forwarded-For', `10.8.${(callers >> 8) & 255}.${callers++ & 255}`);

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

const makeDesigner = async (overrides = {}) => {
  const res = await api('post', '/api/designers/admin')
    .set('Cookie', adminCookie)
    .send({ name: `Designer ${Math.random().toString(36).slice(2, 7)}`, ...overrides });
  return res.body.designer;
};

const book = (overrides = {}) =>
  api('post', '/api/consultations').send({
    fullName: 'Ada Obi',
    email: 'ada@example.com',
    phone: '08030000000',
    ...overrides,
  });

describe('designers', () => {
  it('creates one, and lists only the active ones publicly', async () => {
    const active = await makeDesigner({ title: 'Lead Designer' });
    const retired = await makeDesigner();
    await api('put', `/api/designers/admin/${retired._id}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false });

    const publicList = await api('get', '/api/designers');
    const adminList = await api('get', '/api/designers/admin').set('Cookie', adminCookie);

    expect(publicList.body.designers.map((d) => d._id)).toContain(active._id);
    expect(publicList.body.designers.map((d) => d._id)).not.toContain(retired._id);
    expect(adminList.body.designers.map((d) => d._id)).toContain(retired._id);
  });

  it('needs a name', async () => {
    const res = await api('post', '/api/designers/admin').set('Cookie', adminCookie).send({});

    expect(res.status).toBe(400);
  });

  it('deletes a designer who has taken no consultations', async () => {
    const designer = await makeDesigner();

    const res = await api('delete', `/api/designers/admin/${designer._id}`).set(
      'Cookie',
      adminCookie
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('deactivates rather than deletes one who is named on a consultation', async () => {
    const designer = await makeDesigner();
    await book({ preferredDesigner: designer._id });

    const res = await api('delete', `/api/designers/admin/${designer._id}`).set(
      'Cookie',
      adminCookie
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);

    // The name stays on the consultation, which is the point.
    const [row] = await rows('SELECT is_active FROM designers WHERE id = :id', {
      id: designer._id,
    });
    expect(row.is_active).toBe(false);
  });
});

describe('booking a consultation', () => {
  it('records the request, stores the budget in kobo and tells both parties', async () => {
    const res = await book({ budgetMin: 500000, budgetMax: 2000000, notes: 'Two bedrooms' });

    expect(res.status).toBe(201);
    expect(res.body.consultation).toMatchObject({
      fullName: 'Ada Obi',
      status: 'new',
      budgetMin: 500000,
      budgetMax: 2000000,
    });

    const [row] = await rows('SELECT budget_min FROM consultation_requests WHERE id = :id', {
      id: res.body.consultation._id,
    });
    expect(Number(row.budget_min)).toBe(50000000);

    // One to the studio, one to the enquirer.
    expect(sent).toHaveLength(2);
  });

  it('needs a name, an email and a phone number', async () => {
    expect((await book({ fullName: undefined })).status).toBe(400);
    expect((await book({ email: undefined })).status).toBe(400);
    expect((await book({ phone: undefined })).status).toBe(400);
  });

  it('refuses a budget that runs backwards', async () => {
    const res = await book({ budgetMin: 5000000, budgetMax: 100000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/below the minimum/i);
  });

  it('refuses a preferred designer who does not exist', async () => {
    const res = await book({ preferredDesigner: '11111111-1111-4111-8111-111111111111' });

    expect(res.status).toBe(400);
  });

  it('stores the uploaded room photos in order, and the floor plan beside them', async () => {
    const res = await book({
      roomPhotos: ['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'],
      floorPlan: 'data:image/png;base64,CCCC',
      stylePreferences: ['Modern', 'Minimalist'],
    });

    expect(res.body.consultation.roomPhotos).toHaveLength(2);
    expect(res.body.consultation.floorPlan).not.toBeNull();
    expect(res.body.consultation.stylePreferences).toEqual(['Modern', 'Minimalist']);
  });

  it('links the request to the account when the enquirer is signed in', async () => {
    const signedUp = await api('post', '/api/auth/signup').send({
      fullName: 'Chidi Eze',
      email: `chidi-${Math.random().toString(36).slice(2)}@example.com`,
      password: 'Password123!',
    });

    const res = await api('post', '/api/consultations')
      .set('Cookie', asCookie(signedUp))
      .send({ fullName: 'Chidi Eze', email: 'chidi@example.com', phone: '08030000000' });

    expect(res.body.consultation.customerId).toBe(signedUp.body.id);
  });
});

describe('working a consultation', () => {
  const update = (id, body) =>
    api('put', `/api/consultations/admin/${id}`).set('Cookie', adminCookie).send(body);

  it('lists them, newest first, and filters by status', async () => {
    await book();

    const all = await api('get', '/api/consultations/admin').set('Cookie', adminCookie);
    const isNew = await api('get', '/api/consultations/admin?status=new').set(
      'Cookie',
      adminCookie
    );

    expect(all.body.consultations.length).toBeGreaterThan(0);
    expect(isNew.body.consultations.every((c) => c.status === 'new')).toBe(true);
  });

  it('will not schedule one with no time in the diary', async () => {
    const designer = await makeDesigner();
    const { body } = await book();

    const res = await update(body.consultation._id, {
      status: 'scheduled',
      assignedDesigner: designer._id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/date and time/i);
  });

  it('will not schedule one with nobody assigned to take it', async () => {
    const { body } = await book();

    const res = await update(body.consultation._id, {
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/designer/i);
  });

  it('schedules one given both, and reports the designer with it', async () => {
    const designer = await makeDesigner({ title: 'Lead Designer' });
    const { body } = await book();

    const res = await update(body.consultation._id, {
      status: 'scheduled',
      assignedDesigner: designer._id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      meetingLink: 'https://meet.test/abc',
    });

    expect(res.status).toBe(200);
    expect(res.body.consultation).toMatchObject({
      status: 'scheduled',
      meetingLink: 'https://meet.test/abc',
    });
    expect(res.body.consultation.assignedDesigner).toMatchObject({
      _id: designer._id,
      title: 'Lead Designer',
    });
  });

  it('refuses a status that is not one of the four, and a designer who does not exist', async () => {
    const { body } = await book();

    expect((await update(body.consultation._id, { status: 'pondering' })).status).toBe(400);
    expect(
      (
        await update(body.consultation._id, {
          assignedDesigner: '11111111-1111-4111-8111-111111111111',
        })
      ).status
    ).toBe(400);
  });

  it('404s for a consultation that does not exist', async () => {
    const res = await update('11111111-1111-4111-8111-111111111111', { adminNotes: 'x' });

    expect(res.status).toBe(404);
  });

  it('reports each designer’s consultations in the performance report', async () => {
    const designer = await makeDesigner();
    const scheduled = await book();
    const completed = await book();

    await update(scheduled.body.consultation._id, {
      status: 'scheduled',
      assignedDesigner: designer._id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await update(completed.body.consultation._id, {
      status: 'scheduled',
      assignedDesigner: designer._id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await update(completed.body.consultation._id, { status: 'completed' });

    const res = await api('get', '/api/analytics/designers/performance').set(
      'Cookie',
      adminCookie
    );

    const theirs = res.body.data.find((row) => row.designerId === designer._id);
    expect(theirs).toMatchObject({
      totalConsultations: 2,
      scheduledConsultations: 1,
      completedConsultations: 1,
      completionRate: 50,
    });
  });

  it('is closed to an operator without the consultations permission', async () => {
    const editor = await signInAsOperator('editor');

    const res = await api('get', '/api/consultations/admin').set('Cookie', editor);

    expect(res.status).toBe(403);
  });
});
