import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore.js';
import { useProductsStore } from './useProductsStore.js';
import { useCollectionStore } from './useCollectionStore.js';

export const useAdminStore = create((set) => ({
  authUser: null,
  isLoading: false,
  isSidebarOpen: false, // Initial state: sidebar is closed
  isAddingProduct: false,
  isUpdatingProduct: false,
  isDeletingProduct: false,
  isAddingCollection: false,
  isDeletingCollection: false,
  isUpdatingCollection: false,
  // Action to toggle sidebar visibility
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Action to explicitly close the sidebar
  closeSidebar: () => set({ isSidebarOpen: false }),

  // Action to explicitly open the sidebar
  openSidebar: () => set({ isSidebarOpen: true }),

  adminLogin: async (data) => {
    set({ isLoading: true });
    try {
      console.log('Sending login request with data:', data); // Add this
      const res = await axiosInstance.post('/admin/login', data);
      console.log('Login response:', res);
      useAuthStore.setState({
        authUser: res.data,
        isAdmin: res.data?.role === 'admin',
      });
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('Login error:', error); // Add this
      console.error('Error response:', error.response); // Add this
      toast.error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  AdminLogout: async () => {
    try {
      await axiosInstance.post('/admin/logout');
      useAuthStore.setState({ authUser: null });
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error(error.message);
    }
  },

  addProduct: async (data) => {
    try {
      set({ isAddingProduct: true });
      const res = await axiosInstance.post(
        '/admin/operations/addProduct',
        data
      );
      useProductsStore.setState((state) => ({
        products: [...state.products, res.data],
      }));
      toast.success('success');
    } catch (error) {
      toast.error(error.message);
      console.log(error.message);
    } finally {
      set({ isAddingProduct: false });
    }
  },

  updateProduct: async (productId, data) => {
    try {
      set({ isUpdatingProduct: true });
      const res = await axiosInstance.put(
        `admin/operations/updateProduct/${productId}`,
        data
      );
      useProductsStore.setState((state) => ({
        products: state.products.map((p) =>
          p._id === productId ? res.data : p
        ),
        product: res.data,
      }));
      toast.success('success');
    } catch (error) {
      toast.error(error.message);
    } finally {
      set({ isUpdatingProduct: false });
    }
  },

  delProduct: async (Id) => {
    try {
      set({ isDeletingProduct: true });
      await axiosInstance.delete(`admin/operations/delProduct/${Id}`);
      useProductsStore.setState((state) => ({
        products: state.products.filter((p) => p._id !== Id),
      }));
      toast.success('success');
    } catch (error) {
      toast.error(error.message);
    } finally {
      set({ isDeletingProduct: false });
    }
  },

  addCollection: async (data) => {
    try {
      set({ isAddingCollection: true });
      const res = await axiosInstance.post(
        '/admin/operations/addCollection',
        data
      );
      useCollectionStore.setState((state) => ({
        collections: [...state.collections, res.data],
      }));
      toast.success('success');
    } catch (error) {
      console.log(error.message);
    } finally {
      set({ isAddingCollection: false });
    }
  },

  delCollection: async (Id) => {
    try {
      set({ isDeletingCollection: true });
      await axiosInstance.delete(`/admin/operations/delCollection/${Id}`);
      useCollectionStore.setState((state) => ({
        collections: state.collections.filter((p) => p._id !== Id),
      }));
      toast.success('success');
    } catch (error) {
      console.log(error.message);
    } finally {
      set({ isDeletingCollection: false });
    }
  },

  updateCollection: async (Id, data) => {
    try {
      set({ isUpdatingCollection: true });
      const res = await axiosInstance.put(
        `/admin/operations/updateCollection/${Id}`,
        data
      );
      useCollectionStore.setState((state) => ({
        collections: state.collections.map((p) =>
          p._id === Id ? res.data : p
        ),
      }));
      toast.success('success');
    } catch (error) {
      console.log(error.message);
    } finally {
      set({ isUpdatingCollection: false });
    }
  },
}));
