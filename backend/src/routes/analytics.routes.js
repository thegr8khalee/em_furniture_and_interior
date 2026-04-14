import express from 'express';
import {
  getSalesByCategory,
  getSalesByRegion,
  getProductPerformance,
  getDesignerPerformance,
  getCustomerLifetimeValue,
  getConversionFunnel,
  getOverviewStats,
} from '../controllers/analytics.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = express.Router();

// All analytics routes require admin authentication and FINANCE_VIEW permission
// (Analytics is considered a financial reporting feature)
router.use(protectAdminRoute);
router.use(requirePermissions([PERMISSIONS.FINANCE_VIEW]));

// Overview stats
router.get('/overview', getOverviewStats);

// Sales analytics
router.get('/sales/category', getSalesByCategory);
router.get('/sales/region', getSalesByRegion);

// Product performance
router.get('/products/performance', getProductPerformance);

// Designer performance
router.get('/designers/performance', getDesignerPerformance);

// Customer analytics
router.get('/customers/lifetime-value', getCustomerLifetimeValue);
router.get('/customers/conversion-funnel', getConversionFunnel);

export default router;
