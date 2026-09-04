import express from 'express';
import {
  addToCart,
  checkItemExistence,
  clearCart,
  getCart,
  getDetailsByIds,
  removeFromCart,
  updateCartItemQuantity,
} from '../controllers/cart.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

// `identifyGuest` alone, not `identifyGuest, protectRoute`. Chaining protectRoute
// behind it answered 401 to every shopper without a `jwt` cookie, which is every
// guest — so the guest cart these routes exist to serve was unreachable, and the
// storefront quietly fell back to browser storage. The handlers still refuse a
// request that resolves to no principal at all.

router.get('/', identifyGuest, getCart);
router.put('/add', identifyGuest, trackActivity('ADD_TO_CART', 'cart'), addToCart);
router.put('/remove', identifyGuest, trackActivity('REMOVE_FROM_CART', 'cart'), removeFromCart);
router.delete('/clear', identifyGuest, clearCart);
router.put(
  '/updatequantity',
  identifyGuest,
  updateCartItemQuantity
);
router.post('/check-existence', checkItemExistence);
router.post('/details-by-ids', getDetailsByIds);

export default router;
