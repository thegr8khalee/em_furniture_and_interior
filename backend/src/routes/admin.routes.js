// routes/adminAuthRoutes.js

import express from 'express';
import {
  addCollection,
  addProduct,
  addProject,
  adminLogin,
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
import { PERMISSIONS } from '../lib/permissions.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.post(
  '/signup',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.ADMIN_DASHBOARD_VIEW]),
  adminSignup
);
router.post('/login', authLimiter, adminLogin);
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
