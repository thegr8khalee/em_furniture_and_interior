import express from 'express';
import { getProductById, getProducts } from '../controllers/products.controller.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:productId', getProductById);

export default router;
