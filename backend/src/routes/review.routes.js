import express from 'express';
import { addReviewToCollection, addReviewToProduct } from '../controllers/review.controller.js';

const router = express.Router();

router.post('/addToProducts', addReviewToProduct);
router.post('/addToCollections', addReviewToCollection);

export default router;
