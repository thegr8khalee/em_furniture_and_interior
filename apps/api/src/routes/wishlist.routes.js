import express from 'express';
import { addToWishlist, clearWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getWishlist);
router.put('/add', identifyGuest, protectRoute, trackActivity('ADD_TO_WISHLIST', 'wishlist'), addToWishlist);
router.put('/remove', identifyGuest, protectRoute, trackActivity('REMOVE_FROM_WISHLIST', 'wishlist'), removeFromWishlist);
router.delete('/clear', identifyGuest, protectRoute, clearWishlist);

export default router;
