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
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getCart);
router.put('/add', identifyGuest, protectRoute, trackActivity('ADD_TO_CART', 'cart'), addToCart);
router.put('/remove', identifyGuest, protectRoute, trackActivity('REMOVE_FROM_CART', 'cart'), removeFromCart);
router.delete('/clear', identifyGuest, protectRoute, clearCart);
router.put(
  '/updatequantity',
  identifyGuest,
  protectRoute,
  updateCartItemQuantity
);
router.post('/check-existence', checkItemExistence);
router.post('/details-by-ids', getDetailsByIds);

export default router;
