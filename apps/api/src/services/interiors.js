import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { postDesignFee, postDesignFeePaid } from './posting.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';
import { cloudinaryStore } from './imageStore.js';
import { textArray } from '../lib/sql.js';

/**
 * Designers and consultation requests, against PostgreSQL.
 *
 * The interior-design module, and the one part of the system where the database
 * now refuses a state the business plainly did not want. A consultation could be
 * marked "scheduled" with no time and no designer — the handler set the status
 * and nothing else — which is the state that loses a customer, because it looks
 * booked on every screen and is in nobody's diary. Two check constraints,
 * `consultation_scheduled_has_a_time` and `consultation_scheduled_has_a_designer`,
 * make it unrepresentable.
 *
 * Budgets are kobo in the database and naira on the wire.
 */

export class InteriorsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InteriorsError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

// ---------------------------------------------------------------------------
// Designers
// ---------------------------------------------------------------------------

const DESIGNER_COLUMNS =
  'id, name, title, bio, avatar_url, avatar_public_id, is_active, created_at, updated_at';

const publicDesigner = (row) =>
  row && {
    _id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio,
    avatar: { url: row.avatar_url ?? '', public_id: row.avatar_public_id ?? '' },
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export const listDesigners = async ({ activeOnly = false } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT ${DESIGNER_COLUMNS} FROM designers ${activeOnly ? 'WHERE is_active' : ''}
      ORDER BY name`
  );
  return rows.map(publicDesigner);
};

/** An avatar is either a fresh upload or one already hosted. */
const resolveAvatar = async (avatar, store) => {
  if (typeof avatar === 'string' && avatar.startsWith('data:image')) {
    return store.upload(avatar, 'designers');
  }
  if (avatar?.url) {
    return { url: avatar.url, publicId: avatar.public_id ?? avatar.publicId ?? null };
  }
  return null;
};

export const createDesigner = async (
  { name, title, bio, avatar },
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!name) throw new InteriorsError('Designer name is required.');

  const image = await resolveAvatar(avatar, store);

  const row = await selectOne(
    db,
    `INSERT INTO designers (name, title, bio, avatar_url, avatar_public_id)
     VALUES (:name, :title, :bio, :avatarUrl, :avatarPublicId)
     RETURNING ${DESIGNER_COLUMNS}`,
    {
      name,
      title: title || '',
      bio: bio || '',
      avatarUrl: image?.url ?? null,
      avatarPublicId: image?.publicId ?? null,
    }
  );

  return publicDesigner(row);
};

export const updateDesigner = async (
  id,
  { name, title, bio, avatar, isActive },
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(String(id ?? ''))) throw new InteriorsError('Designer not found.', 404);

  const image = avatar === undefined ? null : await resolveAvatar(avatar, store);

  const row = await selectOne(
    db,
    `UPDATE designers SET
       name = COALESCE(:name, name),
       title = COALESCE(:title, title),
       bio = COALESCE(:bio, bio),
       avatar_url = CASE WHEN :avatarGiven THEN :avatarUrl ELSE avatar_url END,
       avatar_public_id = CASE WHEN :avatarGiven THEN :avatarPublicId ELSE avatar_public_id END,
       is_active = COALESCE(:isActive, is_active)
     WHERE id = :id RETURNING ${DESIGNER_COLUMNS}`,
    {
      id,
      name: name ?? null,
      title: title ?? null,
      bio: bio ?? null,
      avatarGiven: avatar !== undefined,
      avatarUrl: image?.url ?? null,
      avatarPublicId: image?.publicId ?? null,
      isActive: typeof isActive === 'boolean' ? isActive : null,
    }
  );

  if (!row) throw new InteriorsError('Designer not found.', 404);
  return publicDesigner(row);
};

/**
 * Retires a designer.
 *
 * Deleting the row would take their name off every consultation they ever ran
 * — `assigned_designer_id` is ON DELETE SET NULL — so a designer with history is
 * deactivated instead, and only one who never took a consultation is removed.
 */
export const removeDesigner = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return { removed: false };

  const used = await selectOne(
    db,
    `SELECT 1 AS found FROM consultation_requests
      WHERE assigned_designer_id = :id OR preferred_designer_id = :id LIMIT 1`,
    { id }
  );

  if (used) {
    const row = await selectOne(
      db,
      `UPDATE designers SET is_active = false WHERE id = :id RETURNING ${DESIGNER_COLUMNS}`,
      { id }
    );
    if (!row) return { removed: false };
    return { removed: true, deactivated: true, designer: publicDesigner(row) };
  }

  const [, result] = await db.query('DELETE FROM designers WHERE id = :id', {
    replacements: { id },
  });
  return { removed: (result?.rowCount ?? 0) > 0, deactivated: false };
};

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------

const CONSULTATION_SELECT = `
  SELECT c.id, c.customer_id, c.full_name, c.email, c.phone, c.budget_min, c.budget_max,
         c.style_preferences, c.floor_plan_url, c.floor_plan_public_id,
         c.preferred_designer_id, c.assigned_designer_id, c.preferred_meeting_type,
         c.meeting_link, c.scheduled_at, c.status, c.notes, c.admin_notes,
         c.fee_amount, c.fee_tax, c.fee_total, c.billed_at, c.fee_paid_on, c.fee_method,
         c.created_at, c.updated_at,
         pd.name AS preferred_designer_name, pd.title AS preferred_designer_title,
         ad.name AS assigned_designer_name, ad.title AS assigned_designer_title,
         COALESCE(photos.list, '[]'::json) AS room_photos
    FROM consultation_requests c
    LEFT JOIN designers pd ON pd.id = c.preferred_designer_id
    LEFT JOIN designers ad ON ad.id = c.assigned_designer_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('url', p.url, 'public_id', p.public_id)
                      ORDER BY p.position) AS list
        FROM consultation_room_photos p WHERE p.consultation_id = c.id
    ) photos ON true
`;

const designerRef = (id, name, title) =>
  id ? { _id: id, name, title } : null;

const publicConsultation = (row) => ({
  _id: row.id,
  customerId: row.customer_id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  budgetMin: toMajor(Number(row.budget_min)),
  budgetMax: toMajor(Number(row.budget_max)),
  stylePreferences: row.style_preferences ?? [],
  roomPhotos: row.room_photos ?? [],
  floorPlan: row.floor_plan_url
    ? { url: row.floor_plan_url, public_id: row.floor_plan_public_id }
    : null,
  preferredDesigner: designerRef(
    row.preferred_designer_id,
    row.preferred_designer_name,
    row.preferred_designer_title
  ),
  assignedDesigner: designerRef(
    row.assigned_designer_id,
    row.assigned_designer_name,
    row.assigned_designer_title
  ),
  preferredMeetingType: row.preferred_meeting_type,
  meetingLink: row.meeting_link ?? '',
  scheduledAt: row.scheduled_at,
  status: row.status,
  // The design work, as money. Zero and unbilled for most: an enquiry that went
  // nowhere is not a debt.
  fee: {
    amount: toMajor(Number(row.fee_amount ?? 0)),
    tax: toMajor(Number(row.fee_tax ?? 0)),
    total: toMajor(Number(row.fee_total ?? 0)),
    billedAt: row.billed_at ?? null,
    paidOn: row.fee_paid_on ?? null,
    method: row.fee_method ?? null,
  },
  notes: row.notes,
  adminNotes: row.admin_notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const uploadIfNew = async (image, folder, store) => {
  if (typeof image === 'string' && image.startsWith('data:image')) {
    return store.upload(image, folder);
  }
  if (image?.url && !String(image.url).startsWith('data:image')) {
    return { url: image.url, publicId: image.public_id ?? image.publicId ?? null };
  }
  return null;
};

export const requestConsultation = async (
  input,
  customerId = null,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  const {
    fullName,
    email,
    phone,
    budgetMin = 0,
    budgetMax = 0,
    stylePreferences,
    roomPhotos,
    floorPlan,
    preferredDesigner,
    preferredMeetingType,
    notes,
  } = input || {};

  if (!fullName || !email || !phone) {
    throw new InteriorsError('Full name, email, and phone are required.');
  }

  if (preferredDesigner) {
    if (!isValidId(String(preferredDesigner))) {
      throw new InteriorsError('Preferred designer not found.');
    }
    const exists = await selectOne(db, 'SELECT 1 AS found FROM designers WHERE id = :id', {
      id: preferredDesigner,
    });
    if (!exists) throw new InteriorsError('Preferred designer not found.');
  }

  // Uploads before the transaction, as everywhere else.
  const photos = [];
  for (const photo of Array.isArray(roomPhotos) ? roomPhotos : []) {
    const uploaded = await uploadIfNew(photo, 'consultations/rooms', store);
    if (uploaded) photos.push(uploaded);
  }
  const plan = await uploadIfNew(floorPlan, 'consultations/floorplans', store);

  const id = await db.transaction(async (transaction) => {
    const row = await selectOne(
      db,
      `INSERT INTO consultation_requests
         (customer_id, full_name, email, phone, budget_min, budget_max, style_preferences,
          floor_plan_url, floor_plan_public_id, preferred_designer_id,
          preferred_meeting_type, notes)
       VALUES (:customerId, :fullName, :email, :phone, :budgetMin, :budgetMax, :stylePreferences,
               :floorPlanUrl, :floorPlanPublicId, :preferredDesignerId,
               :meetingType::meeting_type, :notes)
       RETURNING id`,
      {
        customerId,
        fullName,
        email,
        phone,
        budgetMin: toMinor(Number(budgetMin) || 0),
        budgetMax: toMinor(Number(budgetMax) || 0),
        stylePreferences: textArray(stylePreferences),
        floorPlanUrl: plan?.url ?? null,
        floorPlanPublicId: plan?.publicId ?? null,
        preferredDesignerId: preferredDesigner || null,
        meetingType: preferredMeetingType || 'calendly',
        notes: notes || '',
      },
      { transaction }
    ).catch((error) => {
      if (error?.original?.constraint === 'consultation_budget_ordered') {
        throw new InteriorsError('The maximum budget cannot be below the minimum.');
      }
      if (error?.original?.code === '22P02') {
        throw new InteriorsError(`"${preferredMeetingType}" is not a meeting type.`);
      }
      throw error;
    });

    for (const [position, photo] of photos.entries()) {
      await db.query(
        `INSERT INTO consultation_room_photos (consultation_id, url, public_id, position)
         VALUES (:id, :url, :publicId, :position)`,
        { replacements: { id: row.id, url: photo.url, publicId: photo.publicId, position }, transaction }
      );
    }

    return row.id;
  });

  return getConsultation(id, db);
};

export const getConsultation = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new InteriorsError('Consultation not found.', 404);

  const row = await selectOne(db, `${CONSULTATION_SELECT} WHERE c.id = :id`, { id });
  if (!row) throw new InteriorsError('Consultation not found.', 404);
  return publicConsultation(row);
};

export const listConsultations = async (
  { page = 1, limit = 20, status = null } = {},
  db = getSequelize()
) => {
  const filter = status ? 'WHERE c.status = :status::consultation_status' : '';
  const replacements = { limit, offset: (page - 1) * limit, status };

  const rows = await select(
    db,
    `${CONSULTATION_SELECT} ${filter} ORDER BY c.created_at DESC LIMIT :limit OFFSET :offset`,
    replacements
  );
  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM consultation_requests c ${filter}`,
    replacements
  );

  return { consultations: rows.map(publicConsultation), total: counted.total };
};

/**
 * Moves a consultation along.
 *
 * Scheduling needs a designer and a time. They can arrive in this request or
 * already be on the row, but between them they have to be there — the database
 * refuses the update otherwise, and the message says which is missing rather
 * than reporting a constraint name.
 */
export const updateConsultation = async (id, changes, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new InteriorsError('Consultation not found.', 404);

  const { status, assignedDesigner, meetingLink, scheduledAt, adminNotes } = changes || {};

  if (assignedDesigner) {
    if (!isValidId(String(assignedDesigner))) {
      throw new InteriorsError('Assigned designer not found.');
    }
    const exists = await selectOne(db, 'SELECT 1 AS found FROM designers WHERE id = :id', {
      id: assignedDesigner,
    });
    if (!exists) throw new InteriorsError('Assigned designer not found.');
  }

  const row = await selectOne(
    db,
    `UPDATE consultation_requests SET
       status = COALESCE(:status::consultation_status, status),
       assigned_designer_id = COALESCE(:assignedDesigner, assigned_designer_id),
       meeting_link = CASE WHEN :meetingLinkGiven THEN :meetingLink ELSE meeting_link END,
       scheduled_at = COALESCE(:scheduledAt::timestamptz, scheduled_at),
       admin_notes = COALESCE(:adminNotes, admin_notes)
     WHERE id = :id RETURNING id`,
    {
      id,
      status: status ?? null,
      assignedDesigner: assignedDesigner || null,
      meetingLinkGiven: meetingLink !== undefined,
      meetingLink: meetingLink ?? null,
      scheduledAt: scheduledAt ?? null,
      adminNotes: adminNotes ?? null,
    }
  ).catch((error) => {
    const constraint = error?.original?.constraint;
    if (constraint === 'consultation_scheduled_has_a_time') {
      throw new InteriorsError('A scheduled consultation needs a date and time.');
    }
    if (constraint === 'consultation_scheduled_has_a_designer') {
      throw new InteriorsError('A scheduled consultation needs a designer assigned to it.');
    }
    if (error?.original?.code === '22P02') {
      throw new InteriorsError(`"${status}" is not a consultation status.`);
    }
    throw error;
  });

  if (!row) throw new InteriorsError('Consultation not found.', 404);
  return getConsultation(id, db);
};

/** How each designer's consultations went, for the console's report. */
export const designerPerformance = async (range, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT d.id, d.name,
            count(*)::int AS total,
            count(*) FILTER (WHERE c.status = 'completed')::int AS completed,
            count(*) FILTER (WHERE c.status = 'scheduled')::int AS scheduled,
            count(*) FILTER (WHERE c.status = 'cancelled')::int AS cancelled
       FROM consultation_requests c
       JOIN designers d ON d.id = c.assigned_designer_id
      WHERE c.created_at >= :start AND c.created_at <= :end
      GROUP BY d.id, d.name
      ORDER BY completed DESC`,
    { start: range.start, end: range.end }
  );

  return rows.map((row) => ({
    designerId: row.id,
    designerName: row.name,
    totalConsultations: row.total,
    completedConsultations: row.completed,
    scheduledConsultations: row.scheduled,
    cancelledConsultations: row.cancelled,
    completionRate: row.total > 0 ? (row.completed / row.total) * 100 : 0,
  }));
};

export const countConsultations = async (range, db = getSequelize()) =>
  (
    await selectOne(
      db,
      `SELECT count(*)::int AS total FROM consultation_requests
        WHERE created_at >= :start AND created_at <= :end`,
      { start: range.start, end: range.end }
    )
  ).total;

/**
 * Bills a consultation for the design work.
 *
 * The fee becomes owed at this moment, and the posting commits with it — a
 * consultation that says "billed" with nothing behind it in the books is not a
 * state that can exist. Billed once: a second bill for the same work is a
 * mistake, and the way to change a figure that is already in the books is a
 * credit note, not an edit.
 */
export const billConsultation = async (id, { amount, tax = 0, staffId = null }, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new InteriorsError('Consultation not found.', 404);

  const fee = toMinor(Number(amount));
  const vat = toMinor(Number(tax || 0));

  if (!Number.isFinite(fee) || fee <= 0) {
    throw new InteriorsError('A design fee has to be a positive amount.');
  }
  if (!Number.isFinite(vat) || vat < 0) {
    throw new InteriorsError('VAT cannot be negative.');
  }

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, billed_at FROM consultation_requests WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new InteriorsError('Consultation not found.', 404);
    if (before.billed_at) {
      throw new InteriorsError('This consultation has already been billed.');
    }

    await db.query(
      `UPDATE consultation_requests
          SET fee_amount = :fee, fee_tax = :vat, fee_total = :total,
              billed_at = now(), billed_by = :staffId
        WHERE id = :id`,
      {
        replacements: {
          id,
          fee,
          vat,
          total: fee + vat,
          staffId: isValidId(String(staffId ?? '')) ? staffId : null,
        },
        ...opts,
      }
    );

    await postDesignFee(db, id, opts);
  });

  return getConsultation(id, db);
};

/** Records that a billed design fee has been paid. */
export const payConsultationFee = async (
  id,
  { paymentMethod, paidOn = null },
  db = getSequelize()
) => {
  if (!isValidId(String(id ?? ''))) throw new InteriorsError('Consultation not found.', 404);
  if (!paymentMethod) throw new InteriorsError('How was it paid?');

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, billed_at, fee_paid_on FROM consultation_requests WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new InteriorsError('Consultation not found.', 404);
    if (!before.billed_at) throw new InteriorsError('This consultation has not been billed yet.');
    if (before.fee_paid_on) throw new InteriorsError('This fee is already paid.');

    await db.query(
      `UPDATE consultation_requests
          SET fee_paid_on = COALESCE(:paidOn::date, CURRENT_DATE),
              fee_method = :method::payment_method
        WHERE id = :id`,
      {
        replacements: { id, paidOn: paidOn || null, method: paymentMethod },
        ...opts,
      }
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new InteriorsError(`"${paymentMethod}" is not a payment method.`);
      }
      throw error;
    });

    await postDesignFeePaid(db, id, opts);
  });

  return getConsultation(id, db);
};
