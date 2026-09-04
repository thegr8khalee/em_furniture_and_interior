import express from 'express';
import { addToWishlist, clearWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

// `identifyGuest` alone, not `identifyGuest, protectRoute`. Chaining protectRoute
// behind it answered 401 to every shopper without a `jwt` cookie, which is every
// guest — so the guest cart these routes exist to serve was unreachable, and the
// storefront quietly fell back to browser storage. The handlers still refuse a
// request that resolves to no principal at all.

router.get('/', identifyGuest, getWishlist);
router.put('/add', identifyGuest, trackActivity('ADD_TO_WISHLIST', 'wishlist'), addToWishlist);
router.put('/remove', identifyGuest, trackActivity('REMOVE_FROM_WISHLIST', 'wishlist'), removeFromWishlist);
router.delete('/clear', identifyGuest, clearWishlist);

export default router;
