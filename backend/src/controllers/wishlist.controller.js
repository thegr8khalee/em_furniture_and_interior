// controllers/wishlistController.js

import User from '../models/user.model.js'; // Import User model
import GuestSession from '../models/guest.model.js'; // Import GuestSession model
import Product from '../models/product.model.js'; // Import Product model to check existence
import Collection from '../models/collection.model.js'; // Import Collection model to check existence
import mongoose from 'mongoose';

export const getWishlist = async (req, res) => {
  try {
    let wishlist = [];
    console.log(req.user)
    if (req.user.role === 'admin') {
      return;
    } else if (req.user) {
      // Authenticated user
      const user = await User.findById(req.user._id).populate(
        'wishlist.item',
        'name price images'
      ); // Populate product/collection details
      if (user) {
        wishlist = user.wishlist;
      }
    } else if (req.guestSession) {
      // Guest user
      const guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      }).populate('wishlist.item', 'name price images'); // Populate product/collection details
      if (guestSession) {
        wishlist = guestSession.wishlist;
      }
    } else {
      // No user or guest session, return empty wishlist
      return res
        .status(200)
        .json({ message: 'No active wishlist found.', wishlist: [] });
    }

    res
      .status(200)
      .json({ message: 'Wishlist retrieved successfully.', wishlist });
  } catch (error) {
    console.error('Error in getWishlist controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addToWishlist = async (req, res) => {
  const { itemId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: 'Invalid Item ID format.' });
  }

  try {
    let itemType;
    let foundItem;

    // Try to find the item as a Product
    foundItem = await Product.findById(itemId);
    if (foundItem) {
      itemType = 'Product';
    } else {
      // If not a Product, try to find it as a Collection
      foundItem = await Collection.findById(itemId);
      if (foundItem) {
        itemType = 'Collection';
      } else {
        return res.status(404).json({
          message: 'Item not found (neither Product nor Collection).',
        });
      }
    }

    // Determine if it's an authenticated user or a guest
    if (req.user) {
      // Authenticated user
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Check if the item is already in the wishlist
      const alreadyInWishlist = user.wishlist.some(
        (wishlistItem) =>
          wishlistItem.item.toString() === itemId.toString() &&
          wishlistItem.itemType === itemType
      );

      if (alreadyInWishlist) {
        return res
          .status(200)
          .json({ message: `${itemType} already in user wishlist.` });
      }

      // Add new item to wishlist
      user.wishlist.push({ item: itemId, itemType });

      await user.save();
      res.status(200).json({
        message: `${itemType} added to user wishlist successfully.`,
        wishlist: user.wishlist,
      });
    } else if (req.guestSession) {
      // Guest user
      let guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });

      if (!guestSession) {
        // This case should ideally be handled by identifyGuest middleware,
        // but as a fallback, create a new one if it somehow doesn't exist.
        guestSession = new GuestSession({
          anonymousId: req.guestSession.anonymousId,
          wishlist: [],
        });
      }

      // Check if the item is already in the guest wishlist
      const alreadyInWishlist = guestSession.wishlist.some(
        (wishlistItem) =>
          wishlistItem.item.toString() === itemId.toString() &&
          wishlistItem.itemType === itemType
      );

      if (alreadyInWishlist) {
        return res
          .status(400)
          .json({ message: `${itemType} already in guest wishlist.` });
      }

      // Add new item to guest wishlist
      guestSession.wishlist.push({ item: itemId, itemType });

      await guestSession.save();
      res.status(200).json({
        message: `${itemType} added to guest wishlist successfully.`,
        wishlist: guestSession.wishlist,
      });
    } else {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No user or guest session found.' });
    }
  } catch (error) {
    console.error('Error in addToWishlist controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeFromWishlist = async (req, res) => {
  const { itemId } = req.body;

  console.log(itemId);

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: 'Invalid Item ID format.' });
  }

  try {
    // Determine if it's an authenticated user or a guest
    if (req.user) {
      // Authenticated user
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const initialWishlistLength = user.wishlist.length;
      user.wishlist = user.wishlist.filter(
        (wishlistItem) => wishlistItem.item.toString() !== itemId.toString()
      );

      if (user.wishlist.length === initialWishlistLength) {
        return res
          .status(404)
          .json({ message: 'Item not found in user wishlist.' });
      }

      await user.save();
      res.status(200).json({
        message: 'Item removed from user wishlist successfully.',
        wishlist: user.wishlist,
      });
    } else if (req.guestSession) {
      // Guest user
      const guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });

      if (!guestSession) {
        return res.status(404).json({ message: 'Guest session not found.' });
      }

      const initialWishlistLength = guestSession.wishlist.length;
      guestSession.wishlist = guestSession.wishlist.filter(
        (wishlistItem) => wishlistItem.item.toString() !== itemId.toString()
      );

      if (guestSession.wishlist.length === initialWishlistLength) {
        return res
          .status(404)
          .json({ message: 'Item not found in guest wishlist.' });
      }

      await guestSession.save();
      res.status(200).json({
        message: 'Item removed from guest wishlist successfully.',
        wishlist: guestSession.wishlist,
      });
    } else {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No user or guest session found.' });
    }
  } catch (error) {
    console.error('Error in removeFromWishlist controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const clearWishlist = async (req, res) => {
  try {
    let currentWishlistOwner = null;

    // Determine if the request is from an authenticated user or a guest
    if (req.user && req.user._id) {
      // Authenticated user
      currentWishlistOwner = await User.findById(req.user._id);
      if (!currentWishlistOwner) {
        return res
          .status(404)
          .json({ message: 'Authenticated user not found.' });
      }
      // Clear the user's wishlist
      currentWishlistOwner.wishlist = []; // Assuming wishlist is an array
      await currentWishlistOwner.save();

      // Respond with the updated (empty) wishlist
      return res.status(200).json({
        message: 'Wishlist cleared successfully for user.',
        wishlist: currentWishlistOwner.wishlist,
      });
    } else if (req.guestSession && req.guestSession._id) {
      // Guest user (identified by identifyGuest middleware)
      currentWishlistOwner = await GuestSession.findById(req.guestSession._id);
      if (!currentWishlistOwner) {
        // This case should ideally not happen if identifyGuest middleware is working correctly
        return res.status(404).json({ message: 'Guest session not found.' });
      }
      // Clear the guest's wishlist
      currentWishlistOwner.wishlist = []; // Assuming wishlist is an array
      await currentWishlistOwner.save();

      // Respond with the updated (empty) wishlist
      return res.status(200).json({
        message: 'Wishlist cleared successfully for guest.',
        wishlist: currentWishlistOwner.wishlist,
      });
    } else {
      // Neither authenticated user nor guest session found
      return res.status(401).json({
        message: 'Unauthorized: No valid user or guest session found.',
      });
    }
  } catch (error) {
    console.error('Error in clearWishlist controller:', error);
    // Check if headers have already been sent before attempting to send response
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from clearWishlist catch block.'
      );
      return;
    }
    res.status(500).json({
      message: 'Internal Server Error during wishlist clear operation.',
    });
  }
};
