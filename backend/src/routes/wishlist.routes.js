import express from 'express';
import { addToWishlist, clearWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getWishlist);
router.put('/add', identifyGuest, protectRoute, addToWishlist);
router.put('/remove', identifyGuest, protectRoute, removeFromWishlist);
router.delete('/clear', identifyGuest, protectRoute, clearWishlist);

export default router;
