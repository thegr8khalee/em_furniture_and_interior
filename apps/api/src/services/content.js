import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';
import { cloudinaryStore } from './imageStore.js';
import { textArray } from '../lib/sql.js';

/**
 * Blog posts, FAQs and portfolio projects, against PostgreSQL.
 *
 * Three small collections with nothing in common except that they are the
 * things the site says rather than the things it sells, and that each was a
 * Mongo document read directly by its controller.
 *
 * Two rules move into the schema on the way:
 *
 *   - A published post has a publication date (`blog_published_is_dated`). It
 *     was set by one handler, so a post published by any other route had none
 *     and the blog ordered by a null.
 *   - A project's images have positions rather than an array order
 *     (`project_images` unique on position), the same rule the catalog uses.
 *
 * Project prices are kobo in the database and naira on the wire, like every
 * other amount.
 */

export class ContentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ContentError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

const BLOG_COLUMNS = `id, title, slug, excerpt, content, cover_url, cover_public_id,
                      tags, status, published_at, author_id, created_at, updated_at`;

const publicPost = (row) => ({
  _id: row.id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt,
  content: row.content,
  coverImage: row.cover_url ? { url: row.cover_url, public_id: row.cover_public_id } : undefined,
  tags: row.tags ?? [],
  status: row.status,
  publishedAt: row.published_at,
  author: row.author_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * A slug nothing else is using.
 *
 * The loop is still a loop, but it is now racing against a unique index rather
 * than against nothing: two posts created at once with the same title used to
 * both find the slug free and both take it.
 */
const uniqueSlug = async (db, title, excludeId = null) => {
  const base = slugify(title) || 'post';

  const taken = await select(
    db,
    `SELECT slug FROM blog_posts
      WHERE (slug = :base OR slug LIKE :pattern) AND (:excludeId::uuid IS NULL OR id <> :excludeId)`,
    { base, pattern: `${base}-%`, excludeId }
  );

  const used = new Set(taken.map((row) => row.slug));
  if (!used.has(base)) return base;

  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
};

export const listPublishedPosts = async ({ page = 1, limit = 12 } = {}, db = getSequelize()) => {
  const items = await select(
    db,
    `SELECT ${BLOG_COLUMNS} FROM blog_posts WHERE status = 'published'
      ORDER BY published_at DESC, created_at DESC LIMIT :limit OFFSET :offset`,
    { limit, offset: (page - 1) * limit }
  );
  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM blog_posts WHERE status = 'published'`
  );

  return { items: items.map(publicPost), total: counted.total };
};

export const getPostBySlug = async (slug, db = getSequelize()) => {
  const row = await selectOne(
    db,
    `SELECT ${BLOG_COLUMNS} FROM blog_posts WHERE slug = :slug AND status = 'published'`,
    { slug }
  );
  if (!row) throw new ContentError('Blog post not found.', 404);
  return publicPost(row);
};

export const listAllPosts = async ({ page = 1, limit = 20 } = {}, db = getSequelize()) => {
  const items = await select(
    db,
    `SELECT ${BLOG_COLUMNS} FROM blog_posts ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { limit, offset: (page - 1) * limit }
  );
  const counted = await selectOne(db, 'SELECT count(*)::int AS total FROM blog_posts');

  return { items: items.map(publicPost), total: counted.total };
};

const coverOf = (coverImage) => ({
  url: coverImage?.url ?? null,
  publicId: coverImage?.public_id ?? coverImage?.publicId ?? null,
});

export const createPost = async (input, authorId = null, db = getSequelize()) => {
  const { title, content, excerpt, coverImage, tags, status } = input || {};

  if (!title || !content) throw new ContentError('Title and content are required.');

  const published = status === 'published';
  const cover = coverOf(coverImage);

  const row = await selectOne(
    db,
    `INSERT INTO blog_posts (title, slug, excerpt, content, cover_url, cover_public_id,
                             tags, status, published_at, author_id)
     VALUES (:title, :slug, :excerpt, :content, :coverUrl, :coverPublicId,
             :tags, :status::publication_status, :publishedAt, :authorId)
     RETURNING ${BLOG_COLUMNS}`,
    {
      title,
      slug: await uniqueSlug(db, title),
      excerpt: excerpt || '',
      content,
      coverUrl: cover.url,
      coverPublicId: cover.publicId,
      tags: textArray(tags),
      status: published ? 'published' : 'draft',
      publishedAt: published ? new Date() : null,
      authorId,
    }
  );

  return publicPost(row);
};

export const updatePost = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new ContentError('Blog post not found.', 404);

  const existing = await selectOne(db, `SELECT ${BLOG_COLUMNS} FROM blog_posts WHERE id = :id`, {
    id,
  });
  if (!existing) throw new ContentError('Blog post not found.', 404);

  const { title, excerpt, content, coverImage, tags, status } = input || {};
  const retitled = title && title !== existing.title;

  // A post going to draft loses its publication date, and one going to
  // published gets one if it has none — so the constraint is satisfied here
  // rather than discovered at the insert.
  let publishedAt = existing.published_at;
  let nextStatus = existing.status;
  if (status) {
    nextStatus = status === 'published' ? 'published' : 'draft';
    publishedAt =
      nextStatus === 'draft' ? null : (existing.published_at ?? new Date());
  }

  const cover = coverImage === undefined ? null : coverOf(coverImage);

  const row = await selectOne(
    db,
    `UPDATE blog_posts SET
       title = COALESCE(:title, title),
       slug = COALESCE(:slug, slug),
       excerpt = COALESCE(:excerpt, excerpt),
       content = COALESCE(:content, content),
       cover_url = CASE WHEN :coverGiven THEN :coverUrl ELSE cover_url END,
       cover_public_id = CASE WHEN :coverGiven THEN :coverPublicId ELSE cover_public_id END,
       tags = COALESCE(:tags, tags),
       status = :status::publication_status,
       published_at = :publishedAt
     WHERE id = :id
     RETURNING ${BLOG_COLUMNS}`,
    {
      id,
      title: title ?? null,
      slug: retitled ? await uniqueSlug(db, title, id) : null,
      excerpt: excerpt ?? null,
      content: content ?? null,
      coverGiven: coverImage !== undefined,
      coverUrl: cover?.url ?? null,
      coverPublicId: cover?.publicId ?? null,
      tags: tags === undefined ? null : textArray(tags),
      status: nextStatus,
      publishedAt,
    }
  );

  return publicPost(row);
};

export const deletePost = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM blog_posts WHERE id = :id', {
    replacements: { id },
  });
  return (result?.rowCount ?? 0) > 0;
};

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

const publicFaq = (row) => ({
  _id: row.id,
  question: row.question,
  answer: row.answer,
  order: row.position,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const FAQ_COLUMNS = 'id, question, answer, position, is_active, created_at, updated_at';

export const listFaqs = async ({ activeOnly = true } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT ${FAQ_COLUMNS} FROM faqs ${activeOnly ? 'WHERE is_active' : ''}
      ORDER BY position, created_at`
  );
  return rows.map(publicFaq);
};

export const createFaq = async ({ question, answer, order, isActive }, db = getSequelize()) => {
  if (!question || !answer) throw new ContentError('Question and answer are required.');

  const row = await selectOne(
    db,
    `INSERT INTO faqs (question, answer, position, is_active)
     VALUES (:question, :answer, :position, :isActive)
     RETURNING ${FAQ_COLUMNS}`,
    {
      question,
      answer,
      position: typeof order === 'number' ? order : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    }
  );

  return publicFaq(row);
};

export const updateFaq = async (id, { question, answer, order, isActive }, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new ContentError('FAQ not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE faqs SET
       question = COALESCE(:question, question),
       answer = COALESCE(:answer, answer),
       position = COALESCE(:position, position),
       is_active = COALESCE(:isActive, is_active)
     WHERE id = :id RETURNING ${FAQ_COLUMNS}`,
    {
      id,
      question: question ?? null,
      answer: answer ?? null,
      position: typeof order === 'number' ? order : null,
      isActive: typeof isActive === 'boolean' ? isActive : null,
    }
  );

  if (!row) throw new ContentError('FAQ not found.', 404);
  return publicFaq(row);
};

export const deleteFaq = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM faqs WHERE id = :id', { replacements: { id } });
  return (result?.rowCount ?? 0) > 0;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const publicProject = (row) => ({
  _id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  location: row.location,
  price: toMajor(Number(row.price)),
  images: row.images ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const PROJECT_SELECT = `
  SELECT p.id, p.title, p.description, p.category, p.location, p.price,
         p.created_at, p.updated_at,
         COALESCE(img.images, '[]'::json) AS images
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('url', i.url, 'public_id', i.public_id)
                      ORDER BY i.position) AS images
        FROM project_images i WHERE i.project_id = p.id
    ) img ON true
`;

export const listProjects = async (
  { page = 1, limit = 12, category = null, search = null } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (category) {
    where.push('p.category = :category');
    replacements.category = category;
  }
  if (search) {
    where.push('(p.title ILIKE :search OR p.description ILIKE :search OR p.location ILIKE :search)');
    replacements.search = `%${search}%`;
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `${PROJECT_SELECT} ${filter} ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset`,
    replacements
  );
  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM projects p ${filter}`,
    replacements
  );

  return { projects: rows.map(publicProject), total: counted.total };
};

export const countProjects = async (db = getSequelize()) =>
  (await selectOne(db, 'SELECT count(*)::int AS total FROM projects')).total;

export const getProject = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new ContentError('Project not found.', 404);

  const row = await selectOne(db, `${PROJECT_SELECT} WHERE p.id = :id`, { id });
  if (!row) throw new ContentError('Project not found.', 404);
  return publicProject(row);
};

/**
 * Uploads whatever is a new image and keeps whatever is already hosted.
 *
 * The same two shapes the catalog accepts, for the same reason: the console
 * sends back a mix of images it is keeping and images it has just chosen.
 */
const resolveImages = async (images, store) => {
  const resolved = [];
  if (!Array.isArray(images)) return resolved;

  for (const entry of images) {
    if (typeof entry === 'string') {
      if (entry.startsWith('data:image')) {
        resolved.push(await store.upload(entry, 'project_images'));
      }
      continue;
    }
    if (entry?.url) {
      if (entry.isNew && String(entry.url).startsWith('data:image')) {
        resolved.push(await store.upload(entry.url, 'project_images'));
      } else if (!entry.isNew) {
        resolved.push({ url: entry.url, publicId: entry.public_id ?? entry.publicId ?? null });
      }
    }
  }

  return resolved;
};

const writeImages = async (db, projectId, images, transaction) => {
  await db.query('DELETE FROM project_images WHERE project_id = :projectId', {
    replacements: { projectId },
    transaction,
  });

  for (const [position, image] of images.entries()) {
    await db.query(
      `INSERT INTO project_images (project_id, url, public_id, position)
       VALUES (:projectId, :url, :publicId, :position)`,
      { replacements: { projectId, url: image.url, publicId: image.publicId, position }, transaction }
    );
  }
};

export const createProject = async (
  input,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  const { title, description, category, location, price, images } = input || {};

  if (!title || !description || !category || !location || price === undefined) {
    throw new ContentError('Please enter all required project fields.');
  }

  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ContentError('Price must be a non-negative number.');
  }

  // Uploads happen before the transaction opens: holding row locks across a
  // network round trip is how a slow image push becomes a database problem.
  const resolved = await resolveImages(images, store);
  if (resolved.length === 0) {
    throw new ContentError('A project needs at least one image.');
  }

  const id = await db.transaction(async (transaction) => {
    const row = await selectOne(
      db,
      `INSERT INTO projects (title, description, category, location, price)
       VALUES (:title, :description, :category, :location, :price) RETURNING id`,
      { title, description, category, location, price: toMinor(amount) },
      { transaction }
    );

    await writeImages(db, row.id, resolved, transaction);
    return row.id;
  });

  return getProject(id, db);
};

export const updateProject = async (
  id,
  input,
  { db = getSequelize(), store = cloudinaryStore } = {}
) => {
  if (!isValidId(String(id ?? ''))) throw new ContentError('Project not found.', 404);

  const existing = await selectOne(db, 'SELECT id FROM projects WHERE id = :id', { id });
  if (!existing) throw new ContentError('Project not found.', 404);

  const { title, description, category, location, price, images } = input || {};

  let amount = null;
  if (price !== undefined) {
    amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ContentError('Price must be a non-negative number.');
    }
  }

  const resolved = images === undefined ? null : await resolveImages(images, store);
  if (resolved && resolved.length === 0) {
    throw new ContentError('A project must have at least one image.');
  }

  await db.transaction(async (transaction) => {
    await db.query(
      `UPDATE projects SET
         title = COALESCE(:title, title),
         description = COALESCE(:description, description),
         category = COALESCE(:category, category),
         location = COALESCE(:location, location),
         price = COALESCE(:price, price)
       WHERE id = :id`,
      {
        replacements: {
          id,
          title: title ?? null,
          description: description ?? null,
          category: category ?? null,
          location: location ?? null,
          price: amount === null ? null : toMinor(amount),
        },
        transaction,
      }
    );

    if (resolved) await writeImages(db, id, resolved, transaction);
  });

  return getProject(id, db);
};

export const deleteProject = async (id, { db = getSequelize(), store = cloudinaryStore } = {}) => {
  if (!isValidId(String(id ?? ''))) return false;

  const images = await select(
    db,
    'SELECT public_id FROM project_images WHERE project_id = :id AND public_id IS NOT NULL',
    { id }
  );

  const [, result] = await db.query('DELETE FROM projects WHERE id = :id', {
    replacements: { id },
  });

  if ((result?.rowCount ?? 0) === 0) return false;

  // After the row is gone, and never allowed to fail the delete: an image left
  // in the bucket costs pennies, a project that would not delete costs an
  // afternoon.
  for (const image of images) {
    await store.destroy(image.public_id).catch(() => {});
  }

  return true;
};
