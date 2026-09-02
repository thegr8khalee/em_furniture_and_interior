// utils/jwt.js
import jwt from 'jsonwebtoken';

const generateToken = (userId, res, role = 'user') => {
    const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
        expiresIn: '15d', // Example expiration
    });

    // Determine SameSite policy based on environment
    let sameSitePolicy = 'Lax'; // Default to Lax for better development experience
    if (process.env.NODE_ENV === 'production') {
        sameSitePolicy = 'None'; // Use 'None' for cross-site requests in production (requires secure: true)
    }

    res.cookie('jwt', token, {
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in ms
        httpOnly: true, // Prevent client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Send cookie only over HTTPS in production
        sameSite: sameSitePolicy, // Dynamically set SameSite
    });
};

export { generateToken };
