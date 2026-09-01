import express from 'express';
import {
	addReviewToCollection,
	addReviewToProduct,
	getPendingProductReviews,
	getPendingCollectionReviews,
	approveProductReview,
	rejectProductReview,
	approveCollectionReview,
	rejectCollectionReview,
} from '../controllers/review.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.post('/products/:productId', protectRoute, createLimiter, trackActivity('REVIEW_SUBMITTED', 'review'), addReviewToProduct);
router.post('/collections/:collectionId', protectRoute, createLimiter, trackActivity('REVIEW_SUBMITTED', 'review'), addReviewToCollection);

router.get(
	'/admin/pending/products',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	getPendingProductReviews
);

router.get(
	'/admin/pending/collections',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	getPendingCollectionReviews
);

router.patch(
	'/admin/products/:productId/reviews/:reviewId/approve',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	createAuditLog('UPDATE', 'review_approve'),
	approveProductReview
);

router.delete(
	'/admin/products/:productId/reviews/:reviewId',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	createAuditLog('DELETE', 'review_reject'),
	rejectProductReview
);

router.patch(
	'/admin/collections/:collectionId/reviews/:reviewId/approve',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	createAuditLog('UPDATE', 'review_approve'),
	approveCollectionReview
);

router.delete(
	'/admin/collections/:collectionId/reviews/:reviewId',
	protectAdminRoute,
	requirePermissions([PERMISSIONS.REVIEWS_MANAGE]),
	createAuditLog('DELETE', 'review_reject'),
	rejectCollectionReview
);

export default router;
