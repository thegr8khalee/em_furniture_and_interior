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

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.put('/update', protectRoute, updateProfile);
router.delete('/delete', protectRoute, deleteAccount);

router.get('/check', checkAuth);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.put('/change-password', protectRoute, changePassword);

export default router;
