import express from 'express';
import { getCollectionById, getCollections, getCollectionsCount } from '../controllers/collection.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.get('/', searchLimiter, getCollections);
router.get('/count', getCollectionsCount);
router.get('/:collectionId', trackActivity('COLLECTION_VIEW', 'collection'), getCollectionById);

export default router;
