import { logger } from '../lib/logger.js';
import {
  InventoryError,
  adjustStock,
  listStock,
  movementsFor,
  stockFor,
  setCostPrice,
} from '../services/inventory.js';

/*
 * Stock. The balance is derived from `stock_movements`, so there is nothing
 * here that sets a quantity — an adjustment records the movement that explains
 * the new figure, and the figure follows.
 */

const fail = (error, res, where) => {
  if (error instanceof InventoryError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getInventoryProducts = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  try {
    const { products, total } = await listStock({
      page,
      limit,
      search: req.query.search || null,
      lowStock: req.query.lowStock === 'true',
    });

    res.json({
      success: true,
      products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error fetching inventory products');
  }
};

export const adjustInventory = async (req, res) => {
  try {
    const { product } = await adjustStock(req.params.productId, req.body, req.admin.id);

    res.json({ success: true, message: 'Inventory updated successfully.', product });
  } catch (error) {
    fail(error, res, 'Error adjusting inventory');
  }
};

/**
 * What a piece cost to buy.
 *
 * Behind the inventory permission, and absent from the public product shape:
 * publishing a cost price beside a selling price publishes the margin.
 */
export const putCostPrice = async (req, res) => {
  try {
    const result = await setCostPrice(req.params.productId, req.body?.costPrice);

    res.json({
      success: true,
      message: 'Cost price updated. Future sales will post a cost of goods sold.',
      ...result,
    });
  } catch (error) {
    fail(error, res, 'Error setting a cost price');
  }
};

/** Why the count is what it is. */
export const getOneInventoryProduct = async (req, res) => {
  try {
    res.json({ success: true, product: await stockFor(req.params.productId) });
  } catch (error) {
    fail(error, res, 'Error loading a stock position');
  }
};

export const getInventoryHistory = async (req, res) => {
  try {
    res.json({ success: true, movements: await movementsFor(req.params.productId) });
  } catch (error) {
    fail(error, res, 'Error fetching inventory history');
  }
};
