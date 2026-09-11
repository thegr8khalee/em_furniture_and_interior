import jwt from 'jsonwebtoken';
import { findCustomerById } from '../services/identity.js';
import { logger } from '../lib/logger.js';
import { getClearCookieOptions } from '../lib/cookies.js';

/**
 * Requires a signed-in shopper, and puts them on `req.user`.
 *
 * The account is re-read on every request rather than trusted from the token,
 * so a deleted account stops being able to act immediately instead of at the
 * token's fifteen-day expiry.
 *
 * A token that names no account clears the cookie and answers 401. It used to
 * answer 404 — which the storefront's interceptor does not treat as "signed
 * out", so the client kept a phantom session and retried every request against
 * an account that was gone.
 */
export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // An operator's token is not a shopper's. They are separate tables and
    // separate id spaces, and reading one with the other's id finds nothing.
    if (decoded.role === 'admin') {
      return res.status(403).json({ message: 'Unauthorized - Not a customer account.' });
    }

    const user = await findCustomerById(decoded.userId);

    if (!user) {
      res.clearCookie('jwt', getClearCookieOptions());
      return res.status(401).json({ message: 'Unauthorized - Account not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      res.clearCookie('jwt', getClearCookieOptions());
      return res.status(401).json({ message: 'Unauthorized - Invalid or expired token.' });
    }

    logger.error({ err: error }, 'Error in protectRoute middleware');
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
