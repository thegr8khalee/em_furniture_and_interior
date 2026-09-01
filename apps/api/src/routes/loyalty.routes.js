import express from 'express';
import { getLoyaltySummary, getLoyaltyHistory } from '../controllers/loyalty.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';

const router = express.Router();

router.get('/summary', protectRoute, getLoyaltySummary);
router.get('/history', protectRoute, getLoyaltyHistory);

export default router;
