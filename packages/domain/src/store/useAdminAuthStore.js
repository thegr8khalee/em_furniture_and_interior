import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';

export const useAdminAuthStore = create((set, get) => ({
  adminUser: null,
  isCheckingAdminAuth: true,
  isLoading: false,
  isAdminReady: false,
  permissions: [],

  checkAdminAuth: async () => {
    set({ isCheckingAdminAuth: true });
    try {
      const res = await axiosInstance.get('/admin/check');
      set({
        adminUser: res.data,
        permissions: res.data?.permissions || [],
      });
    } catch (error) {
      set({ adminUser: null, permissions: [] });
    } finally {
      set({ isCheckingAdminAuth: false, isAdminReady: true });
    }
  },

  adminLogin: async (data) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/admin/login', data);
      set({
        adminUser: res.data,
        permissions: res.data?.permissions || [],
      });
      toast.success('Admin logged in successfully');
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Login failed');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  adminLoginWithSupabase: async (accessToken) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/admin/supabase', { accessToken });
      set({
        adminUser: res.data,
        permissions: res.data?.permissions || [],
      });
      toast.success('Admin logged in successfully');
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not complete that sign-in');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  adminLogout: async () => {
    try {
      await axiosInstance.post('/admin/logout');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not reach server. Signed out locally.');
    } finally {
      set({ adminUser: null, permissions: [] });
    }
  },

  hasPermission: (permission) => {
    const permissions = get().permissions || [];
    return permissions.includes(permission);
  },
}));
