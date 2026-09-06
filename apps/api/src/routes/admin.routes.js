// routes/adminAuthRoutes.js

import express from 'express';
import {
  addCollection,
  addProduct,
  addProject,
  adminLogin,
  adminSupabaseSession,
  adminLogout,
  adminSignup,
  delCollection,
  delProduct,
  delProject,
  updateCollection,
  updateProduct,
  updateProject,
} from '../controllers/admin.controller.js';
import { generateCustomDocument } from '../controllers/document.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { authLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// Only super_admin holds STAFF_MANAGE. This route used to ask for
// ADMIN_DASHBOARD_VIEW, which support and every other role above it also hold.
router.post(
  '/signup',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.STAFF_MANAGE]),
  createAuditLog('CREATE', 'staff'),
  adminSignup
);
router.post('/login', authLimiter, adminLogin);

// The same exchange for the console. It links a Supabase identity to an
// operator that already exists; it never creates one.
router.post('/supabase', authLimiter, adminSupabaseSession);
router.post('/logout', adminLogout);

router.post(
  '/operations/addProduct',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PRODUCTS_MANAGE]),
  createAuditLog('CREATE', 'product'),
  addProduct
);
router.put(
  '/operations/updateProduct/:productId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PRODUCTS_MANAGE]),
  createAuditLog('UPDATE', 'product'),
  updateProduct
);
router.delete(
  '/operations/delProduct/:productId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PRODUCTS_MANAGE]),
  createAuditLog('DELETE', 'product'),
  delProduct
);

router.post(
  '/operations/addCollection',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.COLLECTIONS_MANAGE]),
  createAuditLog('CREATE', 'collection'),
  addCollection
);
router.put(
  '/operations/updateCollection/:collectionId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.COLLECTIONS_MANAGE]),
  createAuditLog('UPDATE', 'collection'),
  updateCollection
);
router.delete(
  '/operations/delCollection/:collectionId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.COLLECTIONS_MANAGE]),
  createAuditLog('DELETE', 'collection'),
  delCollection
);
router.post(
  '/operations/addProject',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PROJECTS_MANAGE]),
  createAuditLog('CREATE', 'project'),
  addProject
);
router.put(
  '/operations/updateProject/:projectId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PROJECTS_MANAGE]),
  createAuditLog('UPDATE', 'project'),
  updateProject
);
router.delete(
  '/operations/delProject/:projectId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.PROJECTS_MANAGE]),
  createAuditLog('DELETE', 'project'),
  delProject
);

router.post(
  '/documents/generate',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.FINANCE_VIEW]),
  generateCustomDocument
);

export default router;
