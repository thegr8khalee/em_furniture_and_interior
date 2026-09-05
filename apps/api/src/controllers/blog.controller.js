import { logger } from '../lib/logger.js';
import {
  ContentError,
  createPost,
  deletePost,
  getPostBySlug,
  listAllPosts,
  listPublishedPosts,
  updatePost,
} from '../services/content.js';

/*
 * The blog. Slugs, publication dates and the rest are in services/content.js.
 */

const fail = (error, res, where) => {
  if (error instanceof ContentError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Failed to complete the request.' });
};

const paginate = (req, fallback) => ({
  page: Math.max(parseInt(req.query.page || '1', 10), 1),
  limit: Math.min(Math.max(parseInt(req.query.limit || String(fallback), 10), 1), 50),
});

export const getBlogPosts = async (req, res) => {
  const { page, limit } = paginate(req, 12);

  try {
    const { items, total } = await listPublishedPosts({ page, limit });
    res.status(200).json({ items, total, page, limit });
  } catch (error) {
    fail(error, res, 'Error fetching blog posts');
  }
};

export const getBlogPostBySlug = async (req, res) => {
  try {
    res.status(200).json(await getPostBySlug(req.params.slug));
  } catch (error) {
    fail(error, res, 'Error fetching blog post');
  }
};

export const adminListBlogPosts = async (req, res) => {
  const { page, limit } = paginate(req, 20);

  try {
    const { items, total } = await listAllPosts({ page, limit });
    res.status(200).json({ items, total, page, limit });
  } catch (error) {
    fail(error, res, 'Error fetching admin blog list');
  }
};

export const createBlogPost = async (req, res) => {
  try {
    res.status(201).json(await createPost(req.body, req.admin?.id));
  } catch (error) {
    fail(error, res, 'Error creating blog post');
  }
};

export const updateBlogPost = async (req, res) => {
  try {
    res.status(200).json(await updatePost(req.params.id, req.body));
  } catch (error) {
    fail(error, res, 'Error updating blog post');
  }
};

export const deleteBlogPost = async (req, res) => {
  try {
    if (!(await deletePost(req.params.id))) {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    res.status(200).json({ message: 'Blog post deleted successfully.' });
  } catch (error) {
    fail(error, res, 'Error deleting blog post');
  }
};
