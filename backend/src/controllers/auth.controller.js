// controllers/authController.js

import User from '../models/user.model.js'; // Ensure correct path and .js extension
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/utils.js'; // Assuming generateToken is in utils/jwt.js
import { mergeGuestDataToUser } from './guest.controller.js'; // Import the new merge function

/**
 * @desc Registers a new user
 * @route POST /api/auth/signup
 * @access Public
 */
export const signup = async (req, res) => {
  // Destructure fullName from req.body, but map to username for the User model
  const { fullName, email, password, phoneNumber, anonymousId } = req.body; // Added anonymousId

  try {
    // Input validation
    if (!fullName) {
      return res.status(400).json({ message: 'Full name cannot be empty' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email cannot be empty' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password cannot be empty' });
    }

    // Check if user with given email already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user instance, mapping fullName to username
    const newUser = new User({
      username: fullName, // Map fullName from request to username in model
      email,
      passwordHash, // Store hashed password in passwordHash field
      phoneNumber, // phoneNumber is optional, will be null if not provided
    });

    // Save the new user to the database
    await newUser.save();

    // Generate JWT token and set it as a cookie
    generateToken(newUser._id, res);

    // --- NEW: Merge guest data if anonymousId is provided ---
    if (anonymousId) {
      await mergeGuestDataToUser(newUser._id, anonymousId);
      // Frontend should also clear the anonymousId cookie after this
    }
    // --- END NEW ---

    // Respond with success message and user data (excluding passwordHash)
    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      cart: newUser.cart,
      wishlist: newUser.wishlist,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    });
  } catch (error) {
    console.error('Error in signup controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Authenticates a user and provides a JWT
 * @route POST /api/auth/login
 * @access Public
 */
export const login = async (req, res) => {
  const { email, password, anonymousId } = req.body; // Added anonymousId

  try {
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Compare provided password with hashed password in the database
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash); // Compare with passwordHash
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Generate JWT token and set it as a cookie
    generateToken(user._id, res);

    // --- NEW: Merge guest data if anonymousId is provided ---
    if (anonymousId) {
      await mergeGuestDataToUser(user._id, anonymousId);
      // Frontend should also clear the anonymousId cookie after this
    }
    // --- END NEW ---

    // Respond with user data (excluding passwordHash)
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      cart: user.cart,
      wishlist: user.wishlist,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Error in login Controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Logs out the current user by clearing the JWT cookie
 * @route POST /api/auth/logout
 * @access Private
 */
export const logout = (req, res) => {
  try {
    // Clear the JWT cookie by setting its maxAge to 0
    res.cookie('jwt', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(200).json({ message: 'Logged Out successfully' });
  } catch (error) {
    console.error('Error in logout controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Checks if the user is authenticated
 * @route GET /api/auth/checkAuth
 * @access Private (requires authMiddleware to populate req.user)
 */
export const checkAuth = (req, res) => {
  try {
    // If authMiddleware successfully populated req.user, the user is authenticated
    if (req.user) {
      // Respond with user data (excluding sensitive fields like passwordHash)
      res.status(200).json({
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        cart: req.user.cart,
        wishlist: req.user.wishlist,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      });
    } else {
      // This case should ideally be caught by authMiddleware if it's a protected route
      // But as a fallback, if req.user is somehow not set, respond with unauthenticated
      res.status(401).json({ message: 'Not authenticated' });
    }
  } catch (error) {
    console.error('Error in Check Auth controller: ', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
