import { logger } from '../lib/logger.js';
import {
  listProducts,
  countProducts,
  getProduct,
  getProductsByIds as fetchProductsByIds,
  isValidId,
} from '../services/catalog.js';

// Reads come from PostgreSQL. The response shapes are unchanged — both
// frontends consume `_id`, naira prices and `images[].url`, and changing
// storage and contract in one commit would be impossible to bisect.

export const getProducts = async (req, res) => {
  try {
    res.status(200).json(await listProducts(req.query));
  } catch (error) {
    logger.error({ err: error }, 'Error in getProducts controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProductsCount = async (req, res) => {
  try {
    res.status(200).json({ totalProducts: await countProducts() });
  } catch (error) {
    logger.error({ err: error }, 'Error in getProductsCount controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProductById = async (req, res) => {
  const { productId } = req.params;

  if (!isValidId(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  try {
    const product = await getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(200).json(product);
  } catch (error) {
    logger.error({ err: error }, 'Error in getProductById controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProductsByIds = async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ message: 'ids query param is required.' });
  }

  try {
    res.status(200).json({ products: await fetchProductsByIds(ids) });
  } catch (error) {
    logger.error({ err: error }, 'Error in getProductsByIds controller');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
