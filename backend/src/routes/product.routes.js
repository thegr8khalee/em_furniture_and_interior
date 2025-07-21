import express from 'express';
import { getProductById, getProducts, getProductsCount } from '../controllers/products.controller.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/count', getProductsCount);
router.get('/:productId', getProductById);

export default router;
