import express from 'express';
import {
  getActiveBanners,
  getAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getActiveFlashSales,
  getAdminFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} from '../controllers/marketing.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

// Public
router.get('/banners/active', getActiveBanners);
router.get('/flash-sales/active', getActiveFlashSales);

// Admin - Promo banners
router.get(
  '/admin/banners',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  getAdminBanners
);
router.post(
  '/admin/banners',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('CREATE', 'banner'),
  createBanner
);
router.put(
  '/admin/banners/:bannerId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('UPDATE', 'banner'),
  updateBanner
);
router.delete(
  '/admin/banners/:bannerId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('DELETE', 'banner'),
  deleteBanner
);

// Admin - Flash sales
router.get(
  '/admin/flash-sales',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  getAdminFlashSales
);
router.post(
  '/admin/flash-sales',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('CREATE', 'flash_sale'),
  createFlashSale
);
router.put(
  '/admin/flash-sales/:flashSaleId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('UPDATE', 'flash_sale'),
  updateFlashSale
);
router.delete(
  '/admin/flash-sales/:flashSaleId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('DELETE', 'flash_sale'),
  deleteFlashSale
);

export default router;
