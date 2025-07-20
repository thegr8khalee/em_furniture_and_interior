import express from 'express';
import {
  addToCart,
  checkItemExistence,
  clearCart,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
} from '../controllers/cart.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import Product from '../models/product.model.js'; // Adjust path
import Collection from '../models/collection.model.js'; // Adjust path

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
router.post('/check-existence', checkItemExistence);

router.post('/details-by-ids', async (req, res) => {
  try {
    const { productIds = [], collectionIds = [] } = req.body;

    // Fetch products
    const products = await Product.find({ _id: { $in: productIds } });

    // Fetch collections
    const collections = await Collection.find({ _id: { $in: collectionIds } });

    res.status(200).json({ products, collections });
  } catch (error) {
    console.error('Error fetching item details by IDs:', error);
    res.status(500).json({ message: 'Failed to fetch item details.' });
  }
});

export default router;
