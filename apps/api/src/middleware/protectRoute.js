import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const protectRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized - No token provided.' }); // IMPORTANT: Added 'return'
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // If jwt.verify throws an error (e.g., invalid token), it will be caught by the catch block.
        // If it successfully decodes but returns null/undefined for some reason (unlikely with valid token),
        // the subsequent user lookup will handle it.
        if (!decoded) {
            // This case is typically handled by the catch block if jwt.verify fails.
            // However, as a safeguard, explicit check and return.
            return res.status(401).json({ message: 'Unauthorized - Invalid token.' }); // IMPORTANT: Added 'return'
        }

        const user = await User.findById(decoded.userId).select('-passwordHash'); // IMPORTANT: Corrected to '-passwordHash'

        if (!user) {
            res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
            return res.status(404).json({ message: 'User not found.' }); // IMPORTANT: Added 'return'
        }

        req.user = user; // User is authenticated, attach to request object
        next(); // Proceed to the next middleware/controller

    } catch (error) {
        console.log('Error in protectRoute middleware: ', error.message);
        // Clear expired/invalid token cookie
        res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });

        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized - Invalid or expired token.' }); // IMPORTANT: Added 'return'
        }
        // Generic server error for other unexpected issues
        return res.status(500).json({ message: 'Internal server error.' }); // IMPORTANT: Added 'return'
    }
};