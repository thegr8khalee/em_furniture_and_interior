import express from 'express';
import {
  adminListBlogPosts,
  createBlogPost,
  deleteBlogPost,
  updateBlogPost,
} from '../controllers/blog.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.get(
  '/',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.BLOG_MANAGE]),
  adminListBlogPosts
);
router.post(
  '/',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.BLOG_MANAGE]),
  createAuditLog('CREATE', 'blog_post'),
  createBlogPost
);
router.put(
  '/:id',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.BLOG_MANAGE]),
  createAuditLog('UPDATE', 'blog_post'),
  updateBlogPost
);
router.delete(
  '/:id',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.BLOG_MANAGE]),
  createAuditLog('DELETE', 'blog_post'),
  deleteBlogPost
);

export default router;
