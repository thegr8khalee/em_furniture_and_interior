import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';

const normalizeArrayResponse = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const useMarketingStore = create((set) => ({
  banners: [],
  flashSales: [],
  isLoading: false,

  getActiveBanners: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/marketing/banners/active');
      set({ banners: normalizeArrayResponse(res.data, 'banners') });
    } catch (error) {
      console.error('Error fetching active banners:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  getActiveFlashSales: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/marketing/flash-sales/active');
      set({ flashSales: normalizeArrayResponse(res.data, 'flashSales') });
    } catch (error) {
      console.error('Error fetching active flash sales:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
