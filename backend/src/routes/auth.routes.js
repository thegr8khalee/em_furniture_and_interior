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
  updateProfile,
} from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

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
