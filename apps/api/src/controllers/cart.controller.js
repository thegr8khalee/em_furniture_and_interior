import { logger } from '../lib/logger.js';
import { resolveOwner } from '../lib/owner.js';
import * as cart from '../services/cart.js';
import { getCollectionsByIds, getProductsByIds } from '../services/catalog.js';

/**
 * HTTP for the cart. Everything it knows about carts lives in services/cart.js;
 * this file only turns requests into calls and errors into status codes.
 */
const fail = (error, res, where) => {
  if (error instanceof cart.CartError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const getCart = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const items = await cart.getCart(owner);
    res.status(200).json({ message: 'Cart retrieved successfully.', cart: items });
  } catch (error) {
    // An unidentified caller has an empty cart rather than an error: the
    // storefront asks for one on every page load, signed in or not.
    if (error instanceof cart.CartError && error.status === 401) {
      return res.status(200).json({ message: 'No active cart found.', cart: [] });
    }
    fail(error, res, 'getCart');
  }
};

export const addToCart = async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const owner = await resolveOwner(req);
    const { itemType, cart: items } = await cart.addToCart(owner, { itemId, quantity });
    res.status(200).json({
      message: `${itemType} added to ${cart.ownerNoun(owner)} cart successfully.`,
      cart: items,
    });
  } catch (error) {
    fail(error, res, 'addToCart');
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const items = await cart.removeFromCart(owner, req.body.itemId);
    res.status(200).json({
      message: `Item removed from ${cart.ownerNoun(owner)} cart successfully.`,
      cart: items,
    });
  } catch (error) {
    fail(error, res, 'removeFromCart');
  }
};

export const clearCart = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const items = await cart.clearCart(owner);
    res.status(200).json({
      message: `Cart cleared successfully for ${cart.ownerNoun(owner)}.`,
      cart: items,
    });
  } catch (error) {
    fail(error, res, 'clearCart');
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const { itemId, itemType, quantity } = req.body;
    const owner = await resolveOwner(req);
    const items = await cart.setCartItemQuantity(owner, { itemId, itemType, quantity });
    res.status(200).json({
      message: 'Cart item quantity updated successfully.',
      cart: items,
    });
  } catch (error) {
    fail(error, res, 'updateCartItemQuantity');
  }
};

export const checkItemExistence = async (req, res) => {
  try {
    const { productIds = [], collectionIds = [] } = req.body;
    res.status(200).json(await cart.checkItemExistence({ productIds, collectionIds }));
  } catch (error) {
    fail(error, res, 'checkItemExistence');
  }
};

export const getDetailsByIds = async (req, res) => {
  try {
    const { productIds = [], collectionIds = [] } = req.body;
    const [products, collections] = await Promise.all([
      getProductsByIds(productIds),
      getCollectionsByIds(collectionIds),
    ]);
    res.status(200).json({ products, collections });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching item details by IDs');
    res.status(500).json({ message: 'Failed to fetch item details.' });
  }
};
