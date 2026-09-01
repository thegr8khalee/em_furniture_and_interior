import express from 'express';
import {
  validateCoupon,
  applyCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCoupons,
  getCouponById,
} from '../controllers/coupon.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createAuditLog } from '../middleware/auditLogger.js';

const router = express.Router();

router.post('/validate', validateCoupon);
router.post('/apply', applyCoupon);

router.post(
  '/admin/create',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('CREATE', 'coupon'),
  createCoupon
);
router.put(
  '/admin/:couponId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('UPDATE', 'coupon'),
  updateCoupon
);
router.delete(
  '/admin/:couponId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  createAuditLog('DELETE', 'coupon'),
  deleteCoupon
);
router.get(
  '/admin',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  getCoupons
);
router.get(
  '/admin/:couponId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.MARKETING_MANAGE]),
  getCouponById
);

export default router;
