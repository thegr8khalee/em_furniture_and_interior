import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/user.model.js';
import { logger } from '../lib/logger.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
};

/**
 * Identifies the shopper behind a request: a signed-in principal on `req.user`,
 * or an anonymous one on `req.guestSession`. It never refuses — a request with
 * neither is simply a new anonymous shopper.
 *
 * It no longer writes a session row. It used to create one on every request that
 * arrived without a cookie, which meant every crawler and every health check left
 * a row behind; the row is now created by the first write that actually needs
 * one (`ensureGuestSession`, in services/cart.js).
 */
export const identifyGuest = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-passwordHash');
        if (user) {
          req.user = user;
          return next();
        }
      } catch (jwtError) {
        logger.warn({ err: jwtError }, 'Invalid or expired JWT detected');
        res.clearCookie('jwt', cookieOptions);
      }
    }

    let anonymousId = req.cookies.anonymousId;
    if (!anonymousId) {
      anonymousId = uuidv4();
      res.cookie('anonymousId', anonymousId, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    req.guestSession = { anonymousId };
    next();
  } catch (error) {
    logger.error({ err: error }, 'Error in identifyGuest middleware');
    res
      .status(500)
      .json({ message: 'Internal Server Error during session identification.' });
  }
};
