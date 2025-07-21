import express from 'express';
import { getCollectionById, getCollections, getCollectionsCount } from '../controllers/collection.controller.js';

const router = express.Router();

router.get('/', getCollections);
router.get('/count', getCollectionsCount);
router.get('/:collectionId', getCollectionById);

export default router;
