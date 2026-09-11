// middleware/adminAuthMiddleware.js
import jwt from 'jsonwebtoken';
import { findStaffById } from '../services/identity.js';
import { logger } from '../lib/logger.js';

/**
 * @desc Middleware to protect admin routes
 * Verifies JWT, checks for 'admin' role, and attaches the operator to req.admin
 *
 * The permission set is resolved from the `staff` row on every request, not
 * carried in the token: revoking a permission has to take effect now, and a
 * token issued before the change would otherwise keep it for fifteen days.
 *
 * `is_active` is enforced here for the first time. Under Mongo the only way to
 * revoke console access was to delete the account, which also orphaned every
 * audit-log entry pointing at it.
 */
export const protectAdminRoute = async (req, res, next) => {
  try {
    const token = req.cookies.admin_jwt || req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({
        message: 'Not authorized, invalid token or insufficient privileges.',
      });
    }

    const admin = await findStaffById(decoded.userId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: 'Not authorized, this account has been deactivated.' });
    }

    // req.admin is what the audit logger reads; the resolved permissions are
    // what requirePermissions checks.
    req.admin = admin;
    req.adminPermissions = admin.permissions;
    req.adminRole = admin.adminRole;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authorized, token expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Not authorized, invalid token.' });
    }

    logger.error({ err: error }, 'Error in protectAdminRoute middleware');
    res.status(500).json({ message: 'Internal Server Error during token verification.' });
  }
};
