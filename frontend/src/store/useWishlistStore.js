// src/store/useWishlistStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useAuthStore } from './useAuthStore.js';

// Key for local storage wishlist
const LOCAL_STORAGE_WISHLIST_KEY = 'localWishlist';

// Helper to get wishlist from local storage
const getLocalWishlist = () => {
  try {
    const storedWishlist = localStorage.getItem(LOCAL_STORAGE_WISHLIST_KEY);
    // For local storage, we'll store just an array of item IDs
    return storedWishlist ? JSON.parse(storedWishlist) : [];
  } catch (error) {
    console.error('Error parsing local storage wishlist:', error);
    return []; // Return empty array on error
  }
};

// Helper to save wishlist to local storage
const saveLocalWishlist = (wishlist) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_WISHLIST_KEY, JSON.stringify(wishlist));
  } catch (error) {
    console.error('Error saving local storage wishlist:', error);
  }
};

export const useWishlistStore = create((set, get) => ({
  wishlist: null, // Initial wishlist state
  isGettingWishlist: false,
  isAddingToWishlist: false,
  isRemovingFromWishlist: false,

  /**
   * Determines if the current user is authenticated or has a guest session.
   * @returns {boolean} True if authenticated or guest, false otherwise.
   */
  _isUserOrGuestIdentified: () => {
    const authUser = useAuthStore.getState().authUser;
    const anonymousId = Cookies.get('anonymousId');
    return !!authUser || !!anonymousId;
  },

  /**
   * Fetches the current user's or guest's wishlist from backend, or from local storage.
   */
  getwishlist: async () => {
    set({ isGettingWishlist: true });
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.get('/wishlist');
        set({ wishlist: res.data.wishlist || [] }); // Ensure it defaults to an empty array
      } catch (error) {
        console.error('Error loading wishlist from backend:', error);
        toast.error(
          error.response?.data?.message || 'Failed to load wishlist.'
        );
      } finally {
        set({ isGettingWishlist: false });
      }
    } else {
      // Use local storage if no user or guest session
      const localWishlist = getLocalWishlist();
      set({ wishlist: localWishlist, isGettingWishlist: false });
    }
  },

  /**
   * Adds a product/collection to the wishlist.
   * @param {string} itemId - The ID of the item (product or collection) to add.
   * @param {string} [itemType] - Optional: 'Product' or 'Collection'. Only used for backend calls.
   * Not stored in local storage for simplicity as per request.
   */
  addToWishlist: async (itemId, itemType) => {
    // itemType is now optional for local storage path
    set({ isAddingToWishlist: true });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to add to wishlist.'
      );
      set({ isAddingToCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        // Backend still expects itemType to differentiate between product/collection if needed
        const res = await axiosInstance.put('/wishlist/add', {
          itemId,
          itemType,
        });
        set({ wishlist: res.data.wishlist });
        toast.success('Item added to wishlist!');
      } catch (error) {
        console.error('Error adding to wishlist (backend):', error);
        toast.error(
          error.response?.data?.message || 'Failed to add item to wishlist.'
        );
      } finally {
        set({ isAddingToWishlist: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalWishlist = getLocalWishlist();

      // Check if item already exists in local storage (just by ID)
      if (!currentLocalWishlist.includes(itemId)) {
        currentLocalWishlist.push({ item: itemId, itemType, _id: itemId }); // Store just the ID
        saveLocalWishlist(currentLocalWishlist);
        set({ wishlist: currentLocalWishlist, isAddingToWishlist: false });
        toast.success('Item added to local wishlist!');
      } else {
        toast('Item already in local wishlist.', { icon: 'ℹ️' });
        set({ isAddingToWishlist: false });
      }
    }
  },

  /**
   * Removes a product/collection from the wishlist.
   * @param {string} itemId - The ID of the item (product or collection) to remove.
   * @param {string} [itemType] - Optional: 'Product' or 'Collection'. Only used for backend calls.
   * Not used for local storage removal.
   */
  removeFromwishlist: async (itemId, itemType) => {
    // itemType is now optional for local storage path
    set({ isRemovingFromWishlist: true });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to remove from wishlist.'
      );
      set({ isAddingToCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        // Backend still expects itemType to differentiate between product/collection if needed
        const res = await axiosInstance.put('/wishlist/remove', {
          itemId,
          itemType,
        });
        set({ wishlist: res.data.wishlist });
        toast.success('Item removed from wishlist!');
      } catch (error) {
        console.error('Error removing from wishlist (backend):', error);
        toast.error(
          error.response?.data?.message ||
            'Failed to remove item from wishlist.'
        );
      } finally {
        set({ isRemovingFromWishlist: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalWishlist = getLocalWishlist();
      const initialLength = currentLocalWishlist.length;

      // Filter based only on itemId (since itemType is not stored locally)
      const updatedLocalWishlist = currentLocalWishlist.filter(
        (id) => id.item !== itemId
      );

      if (updatedLocalWishlist.length === initialLength) {
        toast.error('Item not found in local wishlist.');
      } else {
        saveLocalWishlist(updatedLocalWishlist);
        set({ wishlist: updatedLocalWishlist, isRemovingFromWishlist: false });
        toast.success('Item removed from local wishlist!');
      }
    }
  },

  /**
   * Clears the entire wishlist.
   */
  clearWishlist: async () => {
    set({ isRemovingFromWishlist: true });
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.delete('/wishlist/clear');
        set({ wishlist: res.data.wishlist || [] });
        toast.success('Wishlist cleared!');
      } catch (error) {
        console.error('Error clearing wishlist (backend):', error);
        toast.error(
          error.response?.data?.message || 'Failed to clear wishlist.'
        );
      } finally {
        set({ isRemovingFromWishlist: false });
      }
    } else {
      // Use local storage if no user or guest session
      saveLocalWishlist([]); // Save an empty array
      set({ wishlist: [], isRemovingFromWishlist: false });
      toast.success('Local wishlist cleared!');
    }
  },
}));
