// routes/guestRoutes.js
import express from 'express';
import {
  addGuestCartItem,
  addGuestWishlistItem,
  getGuestSession,
  removeGuestCartItem,
  removeGuestWishlistItem,
  updateGuestCartItemQuantity,
} from '../controllers/guest.controller.js';

const router = express.Router();

router.get('/session', getGuestSession); // To retrieve guest session data
router.post('/cart/add', addGuestCartItem);
router.put('/cart/update/:productId', updateGuestCartItemQuantity);
router.delete('/cart/remove/:productId', removeGuestCartItem);
router.post('/wishlist/add', addGuestWishlistItem);
router.delete('/wishlist/remove/:itemId', removeGuestWishlistItem);

export default router;
