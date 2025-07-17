// controllers/cartController.js

import User from '../models/user.model.js'; // Import User model
import GuestSession from '../models/guest.model.js'; // Import GuestSession model
import Product from '../models/product.model.js'; // Import Product model to check existence
import Collection from '../models/collection.model.js'; // Import Collection model to check existence
import mongoose from 'mongoose';

export const getCart = async (req, res) => {
  try {
    let entity = null; // Will hold either the User or GuestSession document
    let modelToUpdate = null; // Will hold the Mongoose model (User or GuestSession)

    if (req.user) {
      // Authenticated user
      entity = await User.findById(req.user._id);
      modelToUpdate = User;
    } else if (req.guestSession) {
      // Guest user
      entity = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });
      modelToUpdate = GuestSession;
    } else {
      // No user or guest session, return empty cart
      return res
        .status(200)
        .json({ message: 'No active cart found.', cart: [] });
    }

    if (!entity) {
      // This case should ideally not happen if req.user or req.guestSession exists,
      // but good for robustness.
      return res
        .status(404)
        .json({ message: 'User or guest session not found.' });
    }

    let rawCart = entity.cart; // Get the raw cart array from the entity
    const productIdsInCart = [];
    const collectionIdsInCart = [];

    // Separate item IDs by type
    rawCart.forEach((cartItem) => {
      // Ensure cartItem.item is a string for map keys and $in query
      if (cartItem.item && typeof cartItem.item.toString === 'function') {
        if (cartItem.itemType === 'Product') {
          productIdsInCart.push(cartItem.item);
        } else if (cartItem.itemType === 'Collection') {
          collectionIdsInCart.push(cartItem.item);
        }
      }
    });

    // Fetch only the _id of existing products and collections in batch queries
    const [existingProducts, existingCollections] = await Promise.all([
      Product.find({ _id: { $in: productIdsInCart } }).select('_id'),
      Collection.find({ _id: { $in: collectionIdsInCart } }).select('_id'),
    ]);

    // Create sets for efficient O(1) lookup of existing IDs
    const existingProductIdsSet = new Set(
      existingProducts.map((p) => p._id.toString())
    );
    const existingCollectionIdsSet = new Set(
      existingCollections.map((c) => c._id.toString())
    );

    const cleanedRawCart = [];
    const itemIdsToRemoveFromDb = []; // Store the _id of the cart entries to remove

    // Reconstruct the cart, keeping only items that still exist in the DB
    for (const cartItem of rawCart) {
      const itemIdString = cartItem.item.toString(); // Convert ObjectId to string for comparison

      let existsInDb = false;
      if (cartItem.itemType === 'Product') {
        existsInDb = existingProductIdsSet.has(itemIdString);
      } else if (cartItem.itemType === 'Collection') {
        existsInDb = existingCollectionIdsSet.has(itemIdString);
      }

      if (existsInDb) {
        // Item still exists in DB, keep it in the cart
        cleanedRawCart.push(cartItem);
      } else {
        // Item not found in DB (it was deleted), mark this cart entry for removal
        itemIdsToRemoveFromDb.push(cartItem._id);
      }
    }

    // If any items were identified as deleted, update the cart in the database
    if (itemIdsToRemoveFromDb.length > 0) {
      await modelToUpdate.findByIdAndUpdate(
        entity._id,
        { $pull: { cart: { _id: { $in: itemIdsToRemoveFromDb } } } },
        { new: true } // Return the updated document, though not strictly used here
      );
      // The `cleanedRawCart` array already contains only valid items, so we'll send that.
    }

    // Send the cleaned, but UNPOPULATED, cart back to the frontend
    res
      .status(200)
      .json({ message: 'Cart retrieved successfully.', cart: cleanedRawCart });
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
      res.status(200).json({
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
      res.status(200).json({
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
      res.status(200).json({
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
      res.status(200).json({
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
      currentCartOwner = await User.findById(req.user._id);
      if (!currentCartOwner) {
        return res
          .status(404)
          .json({ message: 'Authenticated user not found.' });
      }
      // FIX: Set cart to an empty array [] to match schema definition
      currentCartOwner.cart = [];
      await currentCartOwner.save();

      return res.status(200).json({
        message: 'Cart cleared successfully for user.',
        cart: currentCartOwner.cart, // This will be []
      });
    } else if (req.guestSession && req.guestSession._id) {
      currentCartOwner = await GuestSession.findById(req.guestSession._id);
      if (!currentCartOwner) {
        return res.status(404).json({ message: 'Guest session not found.' });
      }
      // FIX: Set cart to an empty array [] to match schema definition
      currentCartOwner.cart = [];
      await currentCartOwner.save();

      return res.status(200).json({
        message: 'Cart cleared successfully for guest.',
        cart: currentCartOwner.cart, // This will be []
      });
    } else {
      return res.status(401).json({
        message: 'Unauthorized: No valid user or guest session found.',
      });
    }
  } catch (error) {
    console.error('Error in clearCart controller:', error.message); // Log only message for cleaner output
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

export const updateCartItemQuantity = async (req, res) => {
  const { itemId, itemType, quantity } = req.body;

  // Input validation
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: 'Invalid Item ID format.' });
  }
  if (!['Product', 'Collection'].includes(itemType)) {
    return res
      .status(400)
      .json({ message: 'Invalid item type. Must be Product or Collection.' });
  }
  if (typeof quantity !== 'number' || quantity < 0) {
    // Quantity can be 0 to trigger removal
    return res
      .status(400)
      .json({ message: 'Quantity must be a non-negative number.' });
  }

  try {
    let cartOwner = null;

    // Determine if it's an authenticated user or a guest
    if (req.user && req.user._id) {
      cartOwner = await User.findById(req.user._id);
    } else if (req.guestSession && req.guestSession._id) {
      cartOwner = await GuestSession.findOne({
        anonymousId: req.guestSession.anonymousId,
      });
    } else {
      return res
        .status(401)
        .json({ message: 'Unauthorized: No user or guest session found.' });
    }

    if (!cartOwner) {
      return res.status(404).json({ message: 'Cart owner not found.' });
    }

    // Ensure cart.items exists and is an array
    if (!cartOwner.cart || !Array.isArray(cartOwner.cart)) {
      cartOwner.cart = []; // Initialize if it's missing or not an array
    }

    // Find the item in the cart
    const itemIndex = cartOwner.cart.findIndex(
      (cartItem) =>
        cartItem.item.toString() === itemId.toString() &&
        cartItem.itemType === itemType
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart.' });
    }

    // Update quantity or remove item if quantity is 0
    if (quantity === 0) {
      cartOwner.cart.splice(itemIndex, 1); // Remove item
    } else {
      cartOwner.cart[itemIndex].quantity = quantity; // Update quantity
    }

    await cartOwner.save();

    // Respond with the updated cart items array (without populating 'item')
    res.status(200).json({
      message: 'Cart item quantity updated successfully.',
      cart: cartOwner.cart, // Send back the raw cart array
    });
  } catch (error) {
    console.error('Error in updateCartItemQuantity controller:', error);
    // Check if headers have already been sent before attempting to send response
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from updateCartItemQuantity catch block.'
      );
      return;
    }
    res
      .status(500)
      .json({ message: 'Internal Server Error during cart quantity update.' });
  }
};

export const checkItemExistence = async (req, res) => {
  try {
    const { productIds = [], collectionIds = [] } = req.body;

    // Ensure IDs are valid ObjectId types
    const validProductIds = productIds.filter(
      (id) => id && typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)
    );
    const validCollectionIds = collectionIds.filter(
      (id) => id && typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)
    );

    const [existingProducts, existingCollections] = await Promise.all([
      Product.find({ _id: { $in: validProductIds } }).select('_id'), // Only fetch _id for existence check
      Collection.find({ _id: { $in: validCollectionIds } }).select('_id'), // Only fetch _id for existence check
    ]);

    const existingProductMap = new Set(
      existingProducts.map((p) => p._id.toString())
    );
    const existingCollectionMap = new Set(
      existingCollections.map((c) => c._id.toString())
    );

    res.status(200).json({
      existingProductIds: Array.from(existingProductMap),
      existingCollectionIds: Array.from(existingCollectionMap),
    });
  } catch (error) {
    console.error('Error checking item existence:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
