import express from 'express';
import {
  changePassword,
  checkAuth,
  deleteAccount,
  forgotPassword,
  login,
  logout,
  resetPassword,
  signup,
  supabaseSession,
  updateProfile,
} from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.post('/signup', authLimiter, trackActivity('SIGNUP', 'auth'), signup);
router.post('/login', authLimiter, trackActivity('LOGIN', 'auth'), login);

// Sign-in with a Supabase access token, which the frontend obtains from
// Supabase's own SDK. Behind the same limiter as the password path: it is a
// sign-in attempt, and an unverified token is as cheap to guess at.
router.post(
  '/supabase',
  authLimiter,
  trackActivity('LOGIN', 'auth'),
  supabaseSession
);
router.post('/logout', logout);
router.put('/update', protectRoute, updateProfile);
router.delete('/delete', protectRoute, deleteAccount);

router.get('/check', checkAuth);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPassword);
router.put('/change-password', protectRoute, changePassword);

export default router;
