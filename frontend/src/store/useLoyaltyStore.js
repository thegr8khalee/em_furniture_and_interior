import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';

export const useLoyaltyStore = create((set) => ({
  summary: null,
  history: [],
  isLoading: false,
  error: null,

  getSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get('/loyalty/summary');
      set({ summary: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to load loyalty summary',
      });
      throw error;
    }
  },

  getHistory: async (page = 1, limit = 20) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get(`/loyalty/history?page=${page}&limit=${limit}`);
      set({ history: res.data.transactions, isLoading: false });
      return res.data;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to load loyalty history',
      });
      throw error;
    }
  },
}));
