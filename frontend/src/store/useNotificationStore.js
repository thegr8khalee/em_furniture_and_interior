import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  getNotifications: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get(`/notifications?page=${page}&limit=${limit}`);
      set({
        notifications: res.data.notifications,
        unreadCount: res.data.unreadCount,
        isLoading: false,
      });
      return res.data;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to fetch notifications',
      });
      throw error;
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const res = await axiosInstance.patch(`/notifications/${notificationId}/read`);
      set((state) => ({
        notifications: state.notifications.map((item) =>
          item._id === notificationId ? res.data.notification : item
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      throw error;
    }
  },

  markAllRead: async () => {
    try {
      await axiosInstance.patch('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((item) => ({
          ...item,
          isRead: true,
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      throw error;
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      await axiosInstance.delete(`/notifications/${notificationId}`);
      set((state) => ({
        notifications: state.notifications.filter((item) => item._id !== notificationId),
      }));
    } catch (error) {
      throw error;
    }
  },
}));
