// controllers/cartController.js

import User from '../models/user.model.js'; // Import User model
import GuestSession from '../models/guest.model.js'; // Import GuestSession model
import Product from '../models/product.model.js'; // Import Product model to check existence
import Collection from '../models/collection.model.js'; // Import Collection model to check existence
import mongoose from 'mongoose';

export const getCart = async (req, res) => {
  try {
    let cart = [];
    if (req.user) {
      // Authenticated user
      const user = await User.findById(req.user._id).populate(
        'cart.item',
        'name price images'
      ); // Populate product/collection details
      if (user) {
        cart = user.cart;
      }
    } else if (req.guestSession) {
      // Guest user
      const guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      }).populate('cart.item', 'name price images'); // Populate product/collection details
      if (guestSession) {
        cart = guestSession.cart;
      }
    } else {
      // No user or guest session, return empty cart
      return res
        .status(200)
        .json({ message: 'No active cart found.', cart: [] });
    }

    res.status(200).json({ message: 'Cart retrieved successfully.', cart });
  } catch (error) {
    console.error('Error in getCart controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addToCart = async (req, res) => {
  // const { itemId } = req.params;
  const { itemId, quantity = 1 } = req.body; // Default quantity to 1
    // console.log(req.body)
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: 'Invalid Item ID format.' });
  }
  if (quantity < 1) {
    return res.status(400).json({ message: 'Quantity must be at least 1.' });
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
        return res
          .status(404)
          .json({
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

      const existingCartItemIndex = user.cart.findIndex(
        (cartItem) =>
          cartItem.item.toString() === itemId.toString() &&
          cartItem.itemType === itemType
      );

      if (existingCartItemIndex > -1) {
        // Item already in cart, update quantity
        user.cart[existingCartItemIndex].quantity += quantity;
      } else {
        // Add new item to cart
        user.cart.push({ item: itemId, itemType, quantity });
      }

      await user.save();
      res
        .status(200)
        .json({
          message: `${itemType} added to user cart successfully.`,
          cart: user.cart,
        });
    } else if (req.guestSession) {
      // Guest user
      let guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });

      if (!guestSession) {
        // This case should ideally be handled by identifyGuest middleware creating a session,
        // but as a fallback, create a new one if it somehow doesn't exist.
        guestSession = new GuestSession({
          anonymousId: req.guestSession.anonymousId,
          cart: [],
        });
      }

      const existingCartItemIndex = guestSession.cart.findIndex(
        (cartItem) =>
          cartItem.item.toString() === itemId.toString() &&
          cartItem.itemType === itemType
      );

      if (existingCartItemIndex > -1) {
        // Item already in guest cart, update quantity
        guestSession.cart[existingCartItemIndex].quantity += quantity;
      } else {
        // Add new item to guest cart
        guestSession.cart.push({ item: itemId, itemType, quantity });
      }

      await guestSession.save();
      res
        .status(200)
        .json({
          message: `${itemType} added to guest cart successfully.`,
          cart: guestSession.cart,
        });
    } else {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No user or guest session found.' });
    }
  } catch (error) {
    console.error('Error in addToCart controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeFromCart = async (req, res) => {
  const { itemId } = req.body;

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

      const initialCartLength = user.cart.length;
      user.cart = user.cart.filter(
        (cartItem) => cartItem.item.toString() !== itemId.toString()
      );

      if (user.cart.length === initialCartLength) {
        return res
          .status(404)
          .json({ message: 'Item not found in user cart.' });
      }

      await user.save();
      res
        .status(200)
        .json({
          message: 'Item removed from user cart successfully.',
          cart: user.cart,
        });
    } else if (req.guestSession) {
      // Guest user
      const guestSession = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });

      if (!guestSession) {
        return res.status(404).json({ message: 'Guest session not found.' });
      }

      const initialCartLength = guestSession.cart.length;
      guestSession.cart = guestSession.cart.filter(
        (cartItem) => cartItem.item.toString() !== itemId.toString()
      );

      if (guestSession.cart.length === initialCartLength) {
        return res
          .status(404)
          .json({ message: 'Item not found in guest cart.' });
      }

      await guestSession.save();
      res
        .status(200)
        .json({
          message: 'Item removed from guest cart successfully.',
          cart: guestSession.cart,
        });
    } else {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No user or guest session found.' });
    }
  } catch (error) {
    console.error('Error in removeFromCart controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const clearCart = async (req, res) => {
  try {
    let currentCartOwner = null;

    // Determine if the request is from an authenticated user or a guest
    if (req.user && req.user._id) {
      // Authenticated user
      currentCartOwner = await User.findById(req.user._id);
      if (!currentCartOwner) {
        return res
          .status(404)
          .json({ message: 'Authenticated user not found.' });
      }
      // Clear the user's cart
      currentCartOwner.cart = { items: [], totalPrice: 0 }; // Assuming cart structure
      await currentCartOwner.save();

      // Respond with the updated (empty) cart
      return res
        .status(200)
        .json({
          message: 'Cart cleared successfully for user.',
          cart: currentCartOwner.cart,
        });
    } else if (req.guestSession && req.guestSession._id) {
      // Guest user (identified by identifyGuest middleware)
      currentCartOwner = await GuestSession.findById(req.guestSession._id);
      if (!currentCartOwner) {
        // This case should ideally not happen if identifyGuest middleware is working correctly
        return res.status(404).json({ message: 'Guest session not found.' });
      }
      // Clear the guest's cart
      currentCartOwner.cart = { items: [], totalPrice: 0 }; // Assuming cart structure
      await currentCartOwner.save();

      // Respond with the updated (empty) cart
      return res
        .status(200)
        .json({
          message: 'Cart cleared successfully for guest.',
          cart: currentCartOwner.cart,
        });
    } else {
      // Neither authenticated user nor guest session found
      return res
        .status(401)
        .json({
          message: 'Unauthorized: No valid user or guest session found.',
        });
    }
  } catch (error) {
    console.error('Error in clearCart controller:', error);
    // Check if headers have already been sent before attempting to send response
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from clearCart catch block.'
      );
      return;
    }
    res
      .status(500)
      .json({ message: 'Internal Server Error during cart clear operation.' });
  }
};
