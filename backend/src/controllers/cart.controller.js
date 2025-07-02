// controllers/cartController.js

import User from '../models/user.model.js'; // Import User model
import GuestSession from '../models/guest.model.js'; // Import GuestSession model
import Product from '../models/product.model.js'; // Import Product model to check existence
import Collection from '../models/collection.model.js'; // Import Collection model to check existence
import mongoose from 'mongoose';

export const getCart = async (req, res) => {
    try {
        let cart = [];
        if (req.user) { // Authenticated user
            const user = await User.findById(req.user._id)
                .populate('cart.item', 'name price images'); // Populate product/collection details
            if (user) {
                cart = user.cart;
            }
        } else if (req.guestSession) { // Guest user
            const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId })
                .populate('cart.item', 'name price images'); // Populate product/collection details
            if (guestSession) {
                cart = guestSession.cart;
            }
        } else {
            // No user or guest session, return empty cart
            return res.status(200).json({ message: 'No active cart found.', cart: [] });
        }

        res.status(200).json({ message: 'Cart retrieved successfully.', cart });

    } catch (error) {
        console.error('Error in getCart controller: ', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const addToCart = async (req, res) => {
    const { itemId } = req.params;
    const { quantity = 1 } = req.body; // Default quantity to 1

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
                return res.status(404).json({ message: 'Item not found (neither Product nor Collection).' });
            }
        }

        // Determine if it's an authenticated user or a guest
        if (req.user) { // Authenticated user
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const existingCartItemIndex = user.cart.findIndex(
                (cartItem) => cartItem.item.toString() === itemId.toString() && cartItem.itemType === itemType
            );

            if (existingCartItemIndex > -1) {
                // Item already in cart, update quantity
                user.cart[existingCartItemIndex].quantity += quantity;
            } else {
                // Add new item to cart
                user.cart.push({ item: itemId, itemType, quantity });
            }

            await user.save();
            res.status(200).json({ message: `${itemType} added to user cart successfully.`, cart: user.cart });

        } else if (req.guestSession) { // Guest user
            let guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });

            if (!guestSession) {
                // This case should ideally be handled by identifyGuest middleware creating a session,
                // but as a fallback, create a new one if it somehow doesn't exist.
                guestSession = new GuestSession({ anonymousId: req.guestSession.anonymousId, cart: [] });
            }

            const existingCartItemIndex = guestSession.cart.findIndex(
                (cartItem) => cartItem.item.toString() === itemId.toString() && cartItem.itemType === itemType
            );

            if (existingCartItemIndex > -1) {
                // Item already in guest cart, update quantity
                guestSession.cart[existingCartItemIndex].quantity += quantity;
            } else {
                // Add new item to guest cart
                guestSession.cart.push({ item: itemId, itemType, quantity });
            }

            await guestSession.save();
            res.status(200).json({ message: `${itemType} added to guest cart successfully.`, cart: guestSession.cart });

        } else {
            return res.status(401).json({ message: 'Unauthorized: No user or guest session found.' });
        }

    } catch (error) {
        console.error('Error in addToCart controller: ', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const removeFromCart = async (req, res) => {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(400).json({ message: 'Invalid Item ID format.' });
    }

    try {
        // Determine if it's an authenticated user or a guest
        if (req.user) { // Authenticated user
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const initialCartLength = user.cart.length;
            user.cart = user.cart.filter(
                (cartItem) => cartItem.item.toString() !== itemId.toString()
            );

            if (user.cart.length === initialCartLength) {
                return res.status(404).json({ message: 'Item not found in user cart.' });
            }

            await user.save();
            res.status(200).json({ message: 'Item removed from user cart successfully.', cart: user.cart });

        } else if (req.guestSession) { // Guest user
            const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });

            if (!guestSession) {
                return res.status(404).json({ message: 'Guest session not found.' });
            }

            const initialCartLength = guestSession.cart.length;
            guestSession.cart = guestSession.cart.filter(
                (cartItem) => cartItem.item.toString() !== itemId.toString()
            );

            if (guestSession.cart.length === initialCartLength) {
                return res.status(404).json({ message: 'Item not found in guest cart.' });
            }

            await guestSession.save();
            res.status(200).json({ message: 'Item removed from guest cart successfully.', cart: guestSession.cart });

        } else {
            return res.status(401).json({ message: 'Unauthorized: No user or guest session found.' });
        }

    } catch (error) {
        console.error('Error in removeFromCart controller: ', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
