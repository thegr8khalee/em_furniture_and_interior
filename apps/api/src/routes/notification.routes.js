import express from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { protectRoute } from '../middleware/protectRoute.js';

const router = express.Router();

router.get('/', protectRoute, getMyNotifications);
router.patch('/:notificationId/read', protectRoute, markAsRead);
router.patch('/read-all', protectRoute, markAllRead);
router.delete('/:notificationId', protectRoute, deleteNotification);

export default router;
