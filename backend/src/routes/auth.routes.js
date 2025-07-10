import express from 'express';
import {
  checkAuth,
  deleteAccount,
  login,
  logout,
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

export default router;
