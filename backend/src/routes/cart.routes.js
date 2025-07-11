import express from 'express';
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
} from '../controllers/cart.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getCart);
router.put('/add', identifyGuest, protectRoute, addToCart);
router.put('/remove', identifyGuest, protectRoute, removeFromCart);
router.delete('/clear', identifyGuest, protectRoute, clearCart);
router.put(
  '/updatequantity',
  identifyGuest,
  protectRoute,
  updateCartItemQuantity
);
export default router;
