import express from 'express';
import { addToCart, getCart, removeFromCart } from '../controllers/cart.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

router.get('/', identifyGuest, protectRoute, getCart);
router.put('/addToCart/:Id', identifyGuest, protectRoute, addToCart);
router.delete('/removeFromCart/:Id', identifyGuest, protectRoute, removeFromCart);

export default router;
