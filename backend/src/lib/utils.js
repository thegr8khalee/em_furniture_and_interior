// utils/jwt.js (example update)
import jwt from 'jsonwebtoken';

const generateToken = (userId, res, role = 'user') => { // Added 'role' parameter
    const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
        expiresIn: '15d', // Example expiration
    });

    res.cookie('jwt', token, {
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in ms
        httpOnly: true, // Prevent client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Send cookie only over HTTPS in production
        sameSite: 'strict', // CSRF protection
    });
};

export { generateToken };