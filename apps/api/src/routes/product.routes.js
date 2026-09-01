import express from 'express';
import {
	getProductById,
	getProducts,
	getProductsByIds,
	getProductsCount,
} from '../controllers/products.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.get('/', searchLimiter, getProducts);
router.get('/count', getProductsCount);
router.get('/by-ids', getProductsByIds);
router.get('/:productId', trackActivity('PRODUCT_VIEW', 'product'), getProductById);

export default router;
