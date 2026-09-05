import express from 'express';
import { getCollectionById, getCollections, getCollectionsCount } from '../controllers/collection.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

router.get('/', searchLimiter, getCollections);
router.get('/count', getCollectionsCount);
// Without identifyGuest the tracker has no principal and records nothing, so
// every view of a collection went unrecorded.
router.get(
  '/:collectionId',
  identifyGuest,
  trackActivity('COLLECTION_VIEW', 'collection'),
  getCollectionById
);

export default router;
