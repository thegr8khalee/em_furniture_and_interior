// controllers/authController.js

import User from '../models/user.model.js'; // Ensure correct path and .js extension
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/utils.js'; // Assuming generateToken is in utils/jwt.js
import { mergeGuestDataToUser } from './guest.controller.js'; // Import the new merge function
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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

export const updateProfile = async (req, res) => {
  try {
    // console.log(req.user._id)
    // req.user is exp
    // ected to be populated by an authentication middleware
    // that verifies the JWT and attaches the user/admin object to the request.
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: 'Not authenticated: User information missing.' });
    }

    const { username, email, phoneNumber } = req.body;
    const userId = req.user._id;
    // console.log(userId)

    let authenticatedEntity = null;

    // Determine which model to use based on the user's role

    authenticatedEntity = await User.findById(userId);

    if (!authenticatedEntity) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Update fields if they are provided in the request body
    if (username !== undefined) {
      authenticatedEntity.username = username;
    }
    if (email !== undefined) {
      // Basic email validation and uniqueness check (more robust validation should be done)
      if (email !== authenticatedEntity.email) {
        // Check if email is actually changing
        const emailExists = await User.findOne({ email });
        if (emailExists && emailExists._id.toString() !== userId.toString()) {
          return res
            .status(400)
            .json({ message: 'Email already in use by another user.' });
        }
      }
      authenticatedEntity.email = email;
    }
    if (phoneNumber !== undefined) {
      authenticatedEntity.phoneNumber = phoneNumber;
    }

    // Save the updated entity to the database
    await authenticatedEntity.save();

    // Prepare the response data, excluding sensitive information like password hash
    const responseData = {
      _id: authenticatedEntity._id,
      username: authenticatedEntity.username,
      email: authenticatedEntity.email,
      phoneNumber: authenticatedEntity.phoneNumber,
      createdAt: authenticatedEntity.createdAt,
      updatedAt: authenticatedEntity.updatedAt,
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in updateProfile controller:', error);
    // Check if headers have already been sent before attempting to send response
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from updateProfile catch block.'
      );
      return;
    }
    res
      .status(500)
      .json({ message: 'Internal Server Error during profile update.' });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const token = req.cookies.jwt; // Get JWT from cookie

    if (!token) {
      // No JWT token found, user is not authenticated.
      return res
        .status(401)
        .json({ message: 'Not authenticated: No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Token is invalid or expired. Clear the cookie.
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      });
      return res
        .status(401)
        .json({ message: 'Not authenticated: Invalid or expired token.' });
    }

    // NEW OPTIMIZED LOGIC: Use the role from the decoded token to perform a single, targeted lookup.
    let authenticatedEntity = null;
    let role = decoded.role; // Get role directly from the token

    if (role === 'admin') {
      authenticatedEntity = await Admin.findById(decoded.userId).select(
        '-passwordHash'
      );
    } else if (role === 'user') {
      authenticatedEntity = await User.findById(decoded.userId).select(
        '-passwordHash'
      );
    } else {
      // Handle unexpected or invalid roles in the token
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      });
      return res
        .status(401)
        .json({ message: 'Not authenticated: Invalid role in token.' });
    }

    if (!authenticatedEntity) {
      // Entity not found in DB despite valid token and role (e.g., account deleted). Clear cookie.
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      });
      return res.status(401).json({
        message: 'Not authenticated: User/Admin account not found in database.',
      });
    }

    // Authenticated entity found, send their details including role
    return res.status(200).json({
      _id: authenticatedEntity._id,
      username: authenticatedEntity.username,
      email: authenticatedEntity.email,
      role: role, // Use the role determined from the token
      // Conditionally include fields specific to User or Admin models
      ...(role === 'user' && {
        phoneNumber: authenticatedEntity.phoneNumber,
        cart: authenticatedEntity.cart,
        wishlist: authenticatedEntity.wishlist,
      }),
      createdAt: authenticatedEntity.createdAt,
      updatedAt: authenticatedEntity.updatedAt,
    });
  } catch (error) {
    console.error('Error in checkAuth controller:', error);
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from checkAuth catch block.'
      );
      return;
    }
    return res
      .status(500)
      .json({ message: 'Internal Server Error during authentication check.' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    console.log(req.user);
    // Ensure user is authenticated and req.user is populated by middleware
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: 'Not authenticated: User information missing.' });
    }

    const userId = req.user._id;
    // const userRole = req.user.role;

    let deletedEntity = null;

    deletedEntity = await User.findByIdAndDelete(userId);

    if (!deletedEntity) {
      return res
        .status(404)
        .json({ message: 'Account not found or already deleted.' });
    }

    // Clear the JWT cookie after successful deletion
    res.clearCookie('jwt', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    });

    res.status(200).json({ message: `your account deleted successfully.` });
  } catch (error) {
    console.error('Error in deleteAccount controller:', error.message);
    if (res.headersSent) {
      console.warn(
        'Headers already sent, cannot send error response from deleteAccount catch block.'
      );
      return;
    }
    res
      .status(500)
      .json({ message: 'Internal Server Error during account deletion.' });
  }
};

/**
 * @desc Request a password reset link (sends email with token)
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ message: 'Please provide an email address.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Send a generic success message to prevent email enumeration attacks
      return res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate a secure, URL-safe random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token expiry (e.g., 1 hour from now)
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour in milliseconds

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Construct the reset URL for the email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // --- EMAIL SENDING LOGIC (Nodemailer) ---
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // You can change this to your email service (e.g., 'Outlook', 'SendGrid', etc.)
      auth: {
        user: process.env.EMAIL_USER, // Your email address from .env
        pass: process.env.EMAIL_PASS, // Your email password or app password from .env
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request for Your Account',
      html: `
        <p>Hello ${user.username || user.email},</p>
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click on the following link to reset your password:</p>
        <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p><code>${resetUrl}</code></p>
        <p>This link is valid for 1 hour. After that, you will need to request a new one.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p>Thank you,</p>
        <p>EM Furniture and Interior Team</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending password reset email:', error);
        // Do NOT send an error response to the client here,
        // as we already sent a generic success message to prevent email enumeration.
        // Log the error for debugging purposes.
      } else {
        console.log('Password reset email sent: %s', info.messageId);
      }
    });
    // --- END EMAIL SENDING LOGIC ---

    res.status(200).json({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Error in forgotPassword controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Reset user password using a token
 * @route POST /api/auth/reset-password/:token
 * @access Public
 */
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'Please provide a new password.' });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password reset token is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Error in resetPassword controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * @desc Change user password (for authenticated users)
 * @route PUT /api/auth/change-password
 * @access Private (requires authentication middleware)
 */
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Please provide both old and new passwords.' });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: 'New password must be at least 6 characters long.' });
  }

  if (!req.user || !req.user._id) {
    return res
      .status(401)
      .json({ message: 'Not authenticated: User information missing.' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isPasswordCorrect = await bcrypt.compare(
      oldPassword,
      user.passwordHash
    );
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Incorrect old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error in changePassword controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
