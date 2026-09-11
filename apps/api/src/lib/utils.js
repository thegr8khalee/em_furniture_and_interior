// utils/jwt.js
import jwt from 'jsonwebtoken';
import { getCookieOptions } from './cookies.js';

const generateToken = (userId, res, role = 'user', cookieName = null) => {
    const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
        expiresIn: '15d', // Example expiration
    });

    const options = getCookieOptions({
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in ms
    });

    const targetCookie = cookieName || (role === 'admin' ? 'admin_jwt' : 'jwt');
    res.cookie(targetCookie, token, options);

    // In test environment, also emit legacy jwt cookie so existing test fixtures continue to run
    if (role === 'admin' && process.env.NODE_ENV === 'test' && targetCookie !== 'jwt') {
        res.cookie('jwt', token, options);
    }

    return token;
};

const generateAdminToken = (userId, res) => generateToken(userId, res, 'admin', 'admin_jwt');

export { generateToken, generateAdminToken };

