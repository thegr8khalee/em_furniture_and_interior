import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';

export const useFaqStore = create((set) => ({
  faqs: [],
  isLoading: false,

  getFAQs: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/faqs');
      set({ faqs: res.data });
    } catch (error) {
      toast.error('Failed to load FAQs.');
    } finally {
      set({ isLoading: false });
    }
  },

  adminListFAQs: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/admin/faqs');
      set({ faqs: res.data });
    } catch (error) {
      toast.error('Failed to load FAQs.');
    } finally {
      set({ isLoading: false });
    }
  },

  createFAQ: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/admin/faqs', payload);
      toast.success('FAQ created.');
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create FAQ.');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateFAQ: async (id, payload) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.put(`/admin/faqs/${id}`, payload);
      toast.success('FAQ updated.');
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update FAQ.');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteFAQ: async (id) => {
    set({ isLoading: true });
    try {
      await axiosInstance.delete(`/admin/faqs/${id}`);
      toast.success('FAQ deleted.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete FAQ.');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
