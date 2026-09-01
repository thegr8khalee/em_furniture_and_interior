import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';

export const useBlogStore = create((set) => ({
  posts: [],
  total: 0,
  page: 1,
  limit: 12,
  isLoading: false,
  activePost: null,

  getBlogPosts: async (page = 1, limit = 12) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/blog', {
        params: { page, limit },
      });
      set({
        posts: res.data.items,
        total: res.data.total,
        page: res.data.page,
        limit: res.data.limit,
      });
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      toast.error(error.response?.data?.message || 'Failed to load blog posts.');
    } finally {
      set({ isLoading: false });
    }
  },

  getBlogPostBySlug: async (slug) => {
    set({ isLoading: true, activePost: null });
    try {
      const res = await axiosInstance.get(`/blog/${slug}`);
      set({ activePost: res.data });
    } catch (error) {
      toast.error('Failed to load blog post.');
    } finally {
      set({ isLoading: false });
    }
  },

  adminListBlogPosts: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/admin/blog');
      set({ posts: res.data.items, total: res.data.total });
    } catch (error) {
      toast.error('Failed to load blog posts.');
    } finally {
      set({ isLoading: false });
    }
  },

  createBlogPost: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.post('/admin/blog', payload);
      toast.success('Blog post created.');
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create blog post.');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateBlogPost: async (id, payload) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.put(`/admin/blog/${id}`, payload);
      toast.success('Blog post updated.');
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update blog post.');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteBlogPost: async (id) => {
    set({ isLoading: true });
    try {
      await axiosInstance.delete(`/admin/blog/${id}`);
      toast.success('Blog post deleted.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete blog post.');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
