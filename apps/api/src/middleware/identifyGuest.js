// middleware/guestMiddleware.js

import jwt from 'jsonwebtoken';
import User from '../models/user.model.js'; // Import User model to check authenticated users
import GuestSession from '../models/guest.model.js'; // Import GuestSession model for anonymous users
import { v4 as uuidv4 } from 'uuid'; // For generating unique anonymous IDs


export const identifyGuest = async (req, res, next) => {
    try {
        // 1. Attempt to identify an authenticated user via JWT
        const token = req.cookies.jwt; // Assuming JWT is stored in an HTTP-only cookie
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId).select('-passwordHash'); // Exclude password hash
                if (user) {
                    req.user = user; // Authenticated user found, populate req.user
                    return next(); // Proceed to the next middleware/route handler for authenticated user
                }
            } catch (jwtError) {
                // Token is invalid or expired, clear the cookie and proceed to guest identification
                console.warn('Invalid or expired JWT detected:', jwtError.message);
                res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
            }
        }

        // 2. If no authenticated user, attempt to identify/create a guest session
        let anonymousId = req.cookies.anonymousId;
        let guestSession;

        if (anonymousId) {
            // Try to find an existing guest session in the database
            guestSession = await GuestSession.findOne({ anonymousId });

            if (guestSession) {
                req.guestSession = { anonymousId: guestSession.anonymousId }; // Guest session found, populate req.guestSession
                // Note: The GuestSession model has a TTL index, so explicit expiration updates aren't strictly needed here,
                // but you could add logic to extend the session's life if desired.
                return next(); // Proceed to the next middleware/route handler for guest user
            } else {
                // Anonymous ID cookie exists but no corresponding session in DB (e.g., DB session expired/deleted)
                console.warn('Anonymous ID cookie found but no matching guest session in database. Creating a new one.');
                res.clearCookie('anonymousId', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
                anonymousId = undefined; // Force creation of a new anonymous ID
            }
        }

        // 3. If no authenticated user and no valid guest session, create a new guest session
        if (!anonymousId) {
            anonymousId = uuidv4(); // Generate a new unique ID for the anonymous session

            // Set the new anonymousId as an HTTP-only cookie for client-side persistence
            res.cookie('anonymousId', anonymousId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches GuestSession TTL in model)
                sameSite: 'Lax', // Adjust SameSite policy as per your needs ('Strict', 'Lax', 'None')
            });

            // Create a new guest session document in the database
            guestSession = new GuestSession({ anonymousId });
            await guestSession.save();
            req.guestSession = { anonymousId: guestSession.anonymousId }; // Populate req.guestSession
            console.log('New guest session created with ID:', anonymousId);
        }

        next(); // Always call next() to pass control to the subsequent middleware or route handler

    } catch (error) {
        console.error('Error in identifyGuest middleware:', error.message);
        // Handle unexpected errors gracefully
        res.status(500).json({ message: 'Internal Server Error during session identification.' });
    }
};
