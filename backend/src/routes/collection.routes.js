import express from 'express';
import { getCollectionById, getCollections } from '../controllers/collection.controller.js';

const router = express.Router();

router.get('/', getCollections);
router.get('/:collectionId', getCollectionById);

export default router;
