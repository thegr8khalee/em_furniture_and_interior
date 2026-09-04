import { logger } from '../lib/logger.js';
import { resolveOwner } from '../lib/owner.js';
import * as cart from '../services/cart.js';

/** HTTP for the wishlist; the behaviour lives in services/cart.js. */
const fail = (error, res, where) => {
  if (error instanceof cart.CartError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const getWishlist = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const wishlist = await cart.getWishlist(owner);
    res.status(200).json({ message: 'Wishlist retrieved successfully.', wishlist });
  } catch (error) {
    if (error instanceof cart.CartError && error.status === 401) {
      return res.status(200).json({ message: 'No active wishlist found.', wishlist: [] });
    }
    fail(error, res, 'getWishlist');
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const { itemType, wishlist } = await cart.addToWishlist(owner, req.body.itemId);
    res.status(200).json({
      message: `${itemType} added to ${cart.ownerNoun(owner)} wishlist successfully.`,
      wishlist,
    });
  } catch (error) {
    fail(error, res, 'addToWishlist');
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const wishlist = await cart.removeFromWishlist(owner, req.body.itemId);
    res.status(200).json({
      message: `Item removed from ${cart.ownerNoun(owner)} wishlist successfully.`,
      wishlist,
    });
  } catch (error) {
    fail(error, res, 'removeFromWishlist');
  }
};

export const clearWishlist = async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    const wishlist = await cart.clearWishlist(owner);
    res.status(200).json({
      message: `Wishlist cleared successfully for ${cart.ownerNoun(owner)}.`,
      wishlist,
    });
  } catch (error) {
    fail(error, res, 'clearWishlist');
  }
};
