import express from 'express';
import { identify } from '../middleware/authenticate.js';
import {
  changePassword,
  checkAuth,
  deleteAccount,
  forgotPassword,
  getSession,
  linkSupabaseIdentity,
  login,
  logout,
  resetPassword,
  signup,
  updateProfile,
} from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

// Resolves a Supabase bearer token when one is present, without rejecting.
// Mounted ahead of the legacy cookie guards so both schemes work during R2.
router.use(identify);

// Works with either authentication scheme; never 401s.
router.get('/session', getSession);
router.post('/link', linkSupabaseIdentity);

router.post('/signup', authLimiter, trackActivity('SIGNUP', 'auth'), signup);
router.post('/login', authLimiter, trackActivity('LOGIN', 'auth'), login);
router.post('/logout', logout);
router.put('/update', protectRoute, updateProfile);
router.delete('/delete', protectRoute, deleteAccount);

router.get('/check', checkAuth);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPassword);
router.put('/change-password', protectRoute, changePassword);

export default router;
