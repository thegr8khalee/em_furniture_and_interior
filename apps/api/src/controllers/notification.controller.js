import { logger } from '../lib/logger.js';
import {
  EngagementError,
  deleteNotification as deleteNotificationRow,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
} from '../services/engagement.js';

const fail = (error, res, where) => {
  if (error instanceof EngagementError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Internal Server Error' });
};

/**
 * Kept under its old name and shape because several controllers call it.
 * A guest order has nobody to notify, and that is not an error.
 */
export const createNotification = ({ userId, title, message, type = 'system', relatedOrder = null }) =>
  notify({ customerId: userId, title, message, type, orderId: relatedOrder });

export const getMyNotifications = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  try {
    const { notifications, total, unreadCount } = await listNotifications(req.user.id, {
      page,
      limit,
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error fetching notifications');
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.notificationId);

    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    res.json({ success: true, notification });
  } catch (error) {
    fail(error, res, 'Error marking notification as read');
  }
};

export const markAllRead = async (req, res) => {
  try {
    res.json({ success: true, updated: await markAllNotificationsRead(req.user.id) });
  } catch (error) {
    fail(error, res, 'Error marking all notifications as read');
  }
};

export const deleteNotification = async (req, res) => {
  try {
    if (!(await deleteNotificationRow(req.user.id, req.params.notificationId))) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    fail(error, res, 'Error deleting notification');
  }
};
