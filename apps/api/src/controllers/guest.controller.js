// controllers/guestController.js

import GuestSession from '../models/guest.model.js'; // Ensure correct path
import User from '../models/user.model.js'; // To interact with User's embedded cart/wishlist
import Product from '../models/product.model.js'; // For product validation
import Collection from '../models/collection.model.js'; // For collection validation
import mongoose from 'mongoose'; // For ObjectId validation

/**
 * Helper function to get or create a GuestSession.
 * This is an internal helper, not an exported controller function.
 * @param {string} anonymousId - The unique ID from the client-side cookie.
 * @returns {Promise<GuestSession>} The guest session document.
 */
const getOrCreateGuestSession = async (anonymousId) => {
  let guestSession = await GuestSession.findOne({ anonymousId });

  if (!guestSession) {
    guestSession = new GuestSession({ anonymousId });
    await guestSession.save();
  }
  return guestSession;
};

/**
 * @desc Get the current anonymous user's cart and wishlist.
 * @route GET /api/guest/session
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId in req.query or req.body.
 * @param {object} res - Express response object.
 */
export const getGuestSession = async (req, res) => {
  const { anonymousId } = req.query || req.body; // Anonymous ID can come from query param or body

  if (!anonymousId) {
    return res.status(400).json({ message: 'Anonymous ID is required.' });
  }

  try {
    const guestSession = await getOrCreateGuestSession(anonymousId);
    // Populate product details for cart items and wishlist items if needed
    await guestSession.populate('cart.productId');
    await guestSession.populate({
      path: 'wishlist.item',
      populate: {
        path: 'collectionId', // Populate collection details if wishlist item is a product
      },
    });

    res.status(200).json(guestSession);
  } catch (error) {
    console.error('Error in getGuestSession controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Add an item to the anonymous user's cart.
 * @route POST /api/guest/cart/add
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId, productId, quantity in req.body.
 * @param {object} res - Express response object.
 */
export const addGuestCartItem = async (req, res) => {
  const { anonymousId, productId, quantity = 1 } = req.body;

  if (
    !anonymousId ||
    !productId ||
    !mongoose.Types.ObjectId.isValid(productId)
  ) {
    return res.status(400).json({
      message: 'Anonymous ID, valid Product ID, and quantity are required.',
    });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    let guestSession = await getOrCreateGuestSession(anonymousId);

    const itemIndex = guestSession.cart.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      // Item exists, update quantity
      guestSession.cart[itemIndex].quantity += quantity;
    } else {
      // Item does not exist, add new
      guestSession.cart.push({ productId, quantity });
    }

    await guestSession.save();
    await guestSession.populate('cart.productId'); // Populate to send back full product details

    res.status(200).json(guestSession.cart);
  } catch (error) {
    console.error('Error in addGuestCartItem controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Update the quantity of an item in the anonymous user's cart.
 * @route PUT /api/guest/cart/update/:productId
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId in req.body, productId in req.params, quantity in req.body.
 * @param {object} res - Express response object.
 */
export const updateGuestCartItemQuantity = async (req, res) => {
  const { anonymousId, quantity } = req.body;
  const { productId } = req.params;

  if (
    !anonymousId ||
    !mongoose.Types.ObjectId.isValid(productId) ||
    typeof quantity !== 'number' ||
    quantity < 0
  ) {
    return res.status(400).json({
      message:
        'Anonymous ID, valid Product ID, and a non-negative quantity are required.',
    });
  }

  try {
    let guestSession = await getOrCreateGuestSession(anonymousId);

    const itemIndex = guestSession.cart.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      if (quantity === 0) {
        // Remove item if quantity is 0
        guestSession.cart.splice(itemIndex, 1);
      } else {
        // Update quantity
        guestSession.cart[itemIndex].quantity = quantity;
      }
      await guestSession.save();
      await guestSession.populate('cart.productId');
      res.status(200).json(guestSession.cart);
    } else {
      res.status(404).json({ message: 'Item not found in cart.' });
    }
  } catch (error) {
    console.error(
      'Error in updateGuestCartItemQuantity controller: ',
      error.message
    );
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Remove an item from the anonymous user's cart.
 * @route DELETE /api/guest/cart/remove/:productId
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId in req.body, productId in req.params.
 * @param {object} res - Express response object.
 */
export const removeGuestCartItem = async (req, res) => {
  const { anonymousId } = req.body;
  const { productId } = req.params;

  if (!anonymousId || !mongoose.Types.ObjectId.isValid(productId)) {
    return res
      .status(400)
      .json({ message: 'Anonymous ID and valid Product ID are required.' });
  }

  try {
    let guestSession = await getOrCreateGuestSession(anonymousId);

    const initialLength = guestSession.cart.length;
    guestSession.cart = guestSession.cart.filter(
      (item) => item.productId.toString() !== productId
    );

    if (guestSession.cart.length < initialLength) {
      await guestSession.save();
      await guestSession.populate('cart.productId');
      res.status(200).json(guestSession.cart);
    } else {
      res.status(404).json({ message: 'Item not found in cart.' });
    }
  } catch (error) {
    console.error('Error in removeGuestCartItem controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Add an item (Product or Collection) to the anonymous user's wishlist.
 * @route POST /api/guest/wishlist/add
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId, itemId, itemType in req.body.
 * @param {object} res - Express response object.
 */
export const addGuestWishlistItem = async (req, res) => {
  const { anonymousId, itemId, itemType } = req.body;

  if (
    !anonymousId ||
    !itemId ||
    !mongoose.Types.ObjectId.isValid(itemId) ||
    !['Product', 'Collection'].includes(itemType)
  ) {
    return res.status(400).json({
      message:
        'Anonymous ID, valid Item ID, and Item Type (Product or Collection) are required.',
    });
  }

  try {
    // Validate if the item actually exists
    let item;
    if (itemType === 'Product') {
      item = await Product.findById(itemId);
    } else if (itemType === 'Collection') {
      item = await Collection.findById(itemId);
    }
    if (!item) {
      return res.status(404).json({ message: `${itemType} not found.` });
    }

    let guestSession = await getOrCreateGuestSession(anonymousId);

    // Check if item already exists in wishlist
    const exists = guestSession.wishlist.some(
      (wishlistItem) =>
        wishlistItem.item.toString() === itemId &&
        wishlistItem.itemType === itemType
    );

    if (!exists) {
      guestSession.wishlist.push({ item: itemId, itemType });
      await guestSession.save();
    }

    // Populate to send back full item details
    await guestSession.populate({
      path: 'wishlist.item',
      populate: {
        path: 'collectionId', // Populate collection details if wishlist item is a product
      },
    });

    res.status(200).json(guestSession.wishlist);
  } catch (error) {
    console.error('Error in addGuestWishlistItem controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Remove an item (Product or Collection) from the anonymous user's wishlist.
 * @route DELETE /api/guest/wishlist/remove/:itemId
 * @access Public
 * @param {object} req - Express request object. Expects anonymousId, itemType in req.body, itemId in req.params.
 * @param {object} res - Express response object.
 */
export const removeGuestWishlistItem = async (req, res) => {
  const { anonymousId, itemType } = req.body;
  const { itemId } = req.params;

  if (
    !anonymousId ||
    !mongoose.Types.ObjectId.isValid(itemId) ||
    !['Product', 'Collection'].includes(itemType)
  ) {
    return res.status(400).json({
      message:
        'Anonymous ID, valid Item ID, and Item Type (Product or Collection) are required.',
    });
  }

  try {
    let guestSession = await getOrCreateGuestSession(anonymousId);

    const initialLength = guestSession.wishlist.length;
    guestSession.wishlist = guestSession.wishlist.filter(
      (wishlistItem) =>
        !(
          wishlistItem.item.toString() === itemId &&
          wishlistItem.itemType === itemType
        )
    );

    if (guestSession.wishlist.length < initialLength) {
      await guestSession.save();
      await guestSession.populate({
        path: 'wishlist.item',
        populate: {
          path: 'collectionId',
        },
      });
      res.status(200).json(guestSession.wishlist);
    } else {
      res.status(404).json({ message: 'Item not found in wishlist.' });
    }
  } catch (error) {
    console.error(
      'Error in removeGuestWishlistItem controller: ',
      error.message
    );
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Merges a guest session's cart and wishlist into a registered user's embedded cart and wishlist.
 * This function is intended to be called internally by authController after successful login/signup.
 * @param {string} userId - The ID of the logged-in or newly signed-up user.
 * @param {string} anonymousId - The anonymous ID from the guest session.
 */
export const mergeGuestDataToUser = async (userId, anonymousId) => {
  if (!userId || !anonymousId) {
    console.warn(
      'mergeGuestDataToUser called with missing userId or anonymousId.'
    );
    return; // Cannot merge without both IDs
  }

  try {
    const user = await User.findById(userId);
    const guestSession = await GuestSession.findOne({ anonymousId });

    if (!user) {
      console.error(
        `User with ID ${userId} not found during guest data merge.`
      );
      return;
    }

    if (!guestSession) {
      console.log(
        `No guest session found for anonymousId: ${anonymousId}. No merge needed.`
      );
      return;
    }

    // Merge Cart
    guestSession.cart.forEach((guestItem) => {
      const existingCartItemIndex = user.cart.findIndex(
        (userItem) =>
          userItem.productId.toString() === guestItem.productId.toString()
      );

      if (existingCartItemIndex > -1) {
        // If product already in user's cart, update quantity
        user.cart[existingCartItemIndex].quantity += guestItem.quantity;
      } else {
        // Else, add new item to user's cart
        user.cart.push(guestItem);
      }
    });

    // Merge Wishlist
    guestSession.wishlist.forEach((guestWishlistItem) => {
      const existsInUserWishlist = user.wishlist.some(
        (userWishlistItem) =>
          userWishlistItem.item.toString() ===
            guestWishlistItem.item.toString() &&
          userWishlistItem.itemType === guestWishlistItem.itemType
      );

      if (!existsInUserWishlist) {
        user.wishlist.push(guestWishlistItem);
      }
    });

    await user.save();
    await GuestSession.deleteOne({ anonymousId }); // Delete the guest session after merging
    console.log(
      `Guest data merged for user ${userId} from anonymous session ${anonymousId}`
    );
  } catch (error) {
    console.error('Error merging guest data to user: ', error.message);
    // Important: Do not block login/signup if merge fails. Log the error.
  }
};
