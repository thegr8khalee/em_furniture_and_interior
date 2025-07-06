import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isLoading: true,
  isAdmin: false,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/auth/check');

      set({
        authUser: res.data, // Assuming backend returns { user: { _id, username, email, role } }
        isAdmin: res.data.role === 'admin', // Set isAdmin based on backend response
      });
    } catch (error) {
      console.log('Error in checkAuth:', error);
      set({ authUser: null });
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (data) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/auth/signup', data);
      set({ authUser: res.data });
      toast.success('account created');
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (data) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/auth/login', data);
      set({ authUser: res.data });
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post('/auth/logout');
      set({ authUser: null });
      toast.success('Logged out successfully');
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.put('/auth/update', data);
      set({ authUser: res.data });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.log(error.message);
      toast.error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },
}));
