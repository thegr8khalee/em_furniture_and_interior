// middleware/adminAuthMiddleware.js
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js'; // Ensure correct path to your Admin model

/**
 * @desc Middleware to protect admin routes
 * Verifies JWT, checks for 'admin' role, and attaches admin user to req.admin
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Next middleware function
 */
export const protectAdminRoute = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies.jwt;

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Not authorized, no token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is valid and contains 'admin' role
    if (!decoded || decoded.role !== 'admin') {
      return res
        .status(403)
        .json({
          message: 'Not authorized, invalid token or insufficient privileges.',
        });
    }

    // Find the admin user by ID from the decoded token
    // Select all fields except the passwordHash for security
    const admin = await Admin.findById(decoded.userId).select('-passwordHash');

    if (!admin) {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    // Attach the admin object to the request for subsequent middleware/controllers
    req.admin = admin;
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('Error in protectAdminRoute middleware: ', error.message);
    // Handle different JWT errors (e.g., TokenExpiredError, JsonWebTokenError)
    if (error.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ message: 'Not authorized, token expired.' });
    } else if (error.name === 'JsonWebTokenError') {
      return res
        .status(401)
        .json({ message: 'Not authorized, invalid token.' });
    }
    res
      .status(500)
      .json({ message: 'Internal Server Error during token verification.' });
  }
};
