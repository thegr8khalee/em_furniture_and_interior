import { create } from 'zustand';
import { axiosInstance, getSupabase, isSupabaseConfigured } from '@em/api-client';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore.js';
import { useProductsStore } from './useProductsStore.js';
import { useCollectionStore } from './useCollectionStore.js';

/** Same two-scheme sign-in as useAuthStore; see the note there. */
const supabaseSignIn = async ({ email, password }) => {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, session: data.session };
};

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
  isAddingProject: false,
  isUpdatingProject: false,
  isDeletingProject: false,

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
      // Staff and customers share one Supabase user pool; the server decides
      // which a caller is, from the database. The legacy admin endpoint stays
      // as a fallback for staff the bulk import has not reached yet.
      const supabase = await supabaseSignIn(data);
      if (!supabase.ok) {
        await axiosInstance.post('/admin/login', data);
      }

      await useAuthStore.getState().checkAuth();
      const { authUser, isAdmin } = useAuthStore.getState();
      if (!authUser || !isAdmin) {
        throw new Error('That account does not have console access.');
      }

      toast.success('Logged in successfully');
      return true;
    } catch (error) {
      // Deliberately not logging `data`: it contains the password, and the
      // previous implementation printed it to the browser console on every
      // sign-in attempt.
      toast.error(error.response?.data?.message || error.message || 'Login failed');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  AdminLogout: async () => {
    try {
      // Both schemes must be cleared, or the session survives in whichever one
      // was missed and the next page load looks signed in.
      if (isSupabaseConfigured()) {
        await getSupabase().auth.signOut().catch(() => {});
      }
      await axiosInstance.post('/admin/logout').catch(() => {});
      toast.success('Logged out successfully');
    } finally {
      useAuthStore.setState({ authUser: null, permissions: [], isAdmin: false });
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

  addProject: async (data) => {
    try {
      set({ isAddingProject: true });
      const res = await axiosInstance.post(
        '/admin/operations/addProject',
        data
      );
      // Optionally, you can manage projects in a separate store similar to products and collections
      toast.success('Project added successfully');
      return res
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isAddingProject: false });
    }
  },

  updateProject: async (projectId, data) => {
    try {
      set({ isUpdatingProject: true });
      const res = await axiosInstance.put(
        `/admin/operations/updateProject/${projectId}`,
        data
      );
      // Optionally, you can manage projects in a separate store similar to products and collections
      toast.success('Project updated successfully');
      return res
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProject: false });
    }
  },

  delProject: async (projectId) => {
    try {
      set({ isDeletingProject: true });
      const res = await axiosInstance.delete(
        `/admin/operations/delProject/${projectId}`
      );
      // Optionally, you can manage projects in a separate store similar to products and collections
      toast.success('Project deleted successfully');
      return res
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isDeletingProject: false });
    }
  },
}));
