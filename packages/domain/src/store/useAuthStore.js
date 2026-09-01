import { create } from 'zustand';
import { axiosInstance, getSupabase, isSupabaseConfigured } from '@em/api-client';
import toast from 'react-hot-toast';

/**
 * Authentication runs on two schemes at once during R2.
 *
 * Supabase is primary: sign-in issues a bearer token that the axios
 * interceptor attaches to every request. The legacy cookie endpoints remain as
 * a fallback, because an account that the bulk import has not reached yet will
 * fail Supabase sign-in with credentials that are perfectly valid locally.
 * Falling back means the migration does not have to be a big-bang cutover.
 *
 * Identity and permissions always come from GET /auth/session — the server
 * decides who someone is, never a claim in the token.
 */
const supabaseSignIn = async ({ email, password }) => {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, session: data.session };
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isLoading: false,
  isAdmin: false,
  isAuthReady: false,
  isRequestingReset: false,
  isResettingPassword: false,
  isChangingPassword: false,
  permissions: [],

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      // Answers for either scheme and never 401s, so a signed-out visitor does
      // not log an error on every page load.
      const res = await axiosInstance.get('/auth/session');
      const { authenticated, kind, user } = res.data;

      if (authenticated && user) {
        set({
          authUser: user,
          isAdmin: kind === 'staff',
          permissions: user.permissions || [],
        });
      } else {
        set({ authUser: null, isAdmin: false, permissions: [] });
      }
    } catch (error) {
      console.log('Error in checkAuth:', error);
      set({ authUser: null, isAdmin: false, permissions: [] });
    } finally {
      set({ isCheckingAuth: false, isAuthReady: true });
    }
  },

  signup: async (data) => {
    set({ isLoading: true });
    try {
      await axiosInstance.post('/auth/signup', data);
      // The account now exists locally. Sign in through Supabase when it is
      // configured so the new session is a bearer one from the outset.
      await supabaseSignIn({ email: data.email, password: data.password });
      await get().checkAuth();
      toast.success('account created');
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (data) => {
    set({ isLoading: true });
    try {
      const supabase = await supabaseSignIn(data);

      if (!supabase.ok) {
        // Not yet imported, or genuinely wrong credentials — the legacy
        // endpoint distinguishes the two by succeeding or failing.
        await axiosInstance.post('/auth/login', data);
      }

      await get().checkAuth();
      if (!get().authUser) throw new Error('Signed in but no account was found.');

      toast.success('Logged in successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Login failed');
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      // Both schemes must be cleared. Signing out of one while the other
      // survives leaves the user apparently logged in on the next page load.
      if (isSupabaseConfigured()) {
        await getSupabase().auth.signOut().catch(() => {});
      }
      await axiosInstance.post('/auth/logout').catch(() => {});
      set({ authUser: null, permissions: [], isAdmin: false });
      toast.success('Logged out successfully');
    } catch (error) {
      console.log('Error in logout:', error);
      set({ authUser: null, permissions: [], isAdmin: false });
    }
  },

  hasPermission: (permission) => {
    const permissions = get().permissions || [];
    return permissions.includes(permission);
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.put('/auth/update', data);
      set({ authUser: res.data });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      await axiosInstance.delete('/auth/delete');
      toast.success('Account deleted');
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Sends a request to the backend to initiate the password reset process.
   * @param {string} email - The email address for which to reset the password.
   */
  forgotPassword: async (email) => {
    set({ isRequestingReset: true });
    try {
      const res = await axiosInstance.post('/auth/forgot-password', { email });
      toast.success(res.data.message); // Backend should return a generic success message
    } catch (error) {
      console.error('Error in forgotPassword store action:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to send reset link. Please try again.'
      );
    } finally {
      set({ isRequestingReset: false });
    }
  },

  /**
   * Resets the user's password using a received token.
   * @param {string} token - The password reset token from the email link.
   * @param {string} newPassword - The new password for the user.
   */
  resetPassword: async (token, newPassword) => {
    set({ isResettingPassword: true });
    try {
      const res = await axiosInstance.post(`/auth/reset-password/${token}`, {
        newPassword,
      });
      toast.success(res.data.message);
    } catch (error) {
      console.error('Error in resetPassword store action:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to reset password. Please try again.'
      );
    } finally {
      set({ isResettingPassword: false });
    }
  },

  /**
   * Allows an authenticated user to change their password.
   * @param {string} oldPassword - The user's current password.
   * @param {string} newPassword - The new password for the user.
   */
  changePassword: async (oldPassword, newPassword) => {
    set({ isChangingPassword: true });
    try {
      const res = await axiosInstance.put('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      toast.success(res.data.message);
    } catch (error) {
      console.error('Error in changePassword store action:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to change password. Please try again.'
      );
    } finally {
      set({ isChangingPassword: false });
    }
  },
}));
