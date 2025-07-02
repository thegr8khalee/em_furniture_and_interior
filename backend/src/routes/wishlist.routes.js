import express from 'express';
import { addToWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getWishlist);
router.put('/addToWishlist/:Id', identifyGuest, protectRoute, addToWishlist);
router.delete('/removeFromWishlist/:Id', identifyGuest, protectRoute, removeFromWishlist);

export default router;
