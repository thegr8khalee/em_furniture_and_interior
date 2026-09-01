/* eslint-disable no-unused-vars */
// src/store/useWishlistStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useAuthStore } from './useAuthStore.js';

// Key for local storage wishlist
const LOCAL_STORAGE_WISHLIST_KEY = 'localWishlist';
const SESSION_STORAGE_WISHLIST_KEY = 'sessionWishlist';

const getLocalWishlist = () => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      // If consent is accepted, prioritize localStorage
      const storedWishlist = localStorage.getItem(LOCAL_STORAGE_WISHLIST_KEY);
      if (storedWishlist) return JSON.parse(storedWishlist);
    }

    // Always check sessionStorage as a fallback or if consent is not given for persistence
    const sessionWishlist = sessionStorage.getItem(
      SESSION_STORAGE_WISHLIST_KEY
    );
    return sessionWishlist ? JSON.parse(sessionWishlist) : [];
  } catch (error) {
    console.error('Error parsing local/session storage wishlist:', error);
    // Fallback to trying the other storage if one fails, or return empty
    try {
      const storedWishlist = localStorage.getItem(LOCAL_STORAGE_WISHLIST_KEY);
      if (storedWishlist) return JSON.parse(storedWishlist);
    } catch (e) {
      console.error('Fallback to localStorage also failed for wishlist:', e);
    }
    try {
      const sessionWishlist = sessionStorage.getItem(
        SESSION_STORAGE_WISHLIST_KEY
      );
      if (sessionWishlist) return JSON.parse(sessionWishlist);
    } catch (e) {
      console.error('Fallback to sessionStorage also failed for wishlist:', e);
    }
    return []; // Return empty array if all fails
  }
};

// Helper to save wishlist to local storage or session storage based on consent
const saveLocalWishlist = (wishlist) => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      // If consent is accepted, save to localStorage and clear sessionStorage
      localStorage.setItem(
        LOCAL_STORAGE_WISHLIST_KEY,
        JSON.stringify(wishlist)
      );
      sessionStorage.removeItem(SESSION_STORAGE_WISHLIST_KEY); // Clear session storage if persistent is used
    } else {
      // If consent is false or not given, save to sessionStorage and clear localStorage
      sessionStorage.setItem(
        SESSION_STORAGE_WISHLIST_KEY,
        JSON.stringify(wishlist)
      );
      localStorage.removeItem(LOCAL_STORAGE_WISHLIST_KEY); // Ensure persistent storage is cleared
    }
  } catch (error) {
    console.error('Error saving local/session storage wishlist:', error);
  }
};

// Helper function to fetch wishlist from backend
const fetchBackendWishlist = async () => {
  try {
    const res = await axiosInstance.get('/wishlist');
    return res.data.wishlist || [];
  } catch (error) {
    console.error('Error loading wishlist from backend:', error);
    // Do NOT toast here, let the calling function handle it for initial load
    throw error; // Re-throw to allow calling function to catch and handle
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
      // Access isAuthReady from useAuthStore's state
      const { authUser, isAuthReady } = useAuthStore.getState();
      const anonymousId = Cookies.get('anonymousId');

      // Only consider identified if auth check is complete AND (user or anonymousId exists)
      return isAuthReady && (!!authUser || !!anonymousId);
    },

  cleanAndGetLocalWishlist: async () => {
    const rawLocalWishlist = getLocalWishlist();
    if (rawLocalWishlist.length === 0) {
      return []; // Nothing to clean
    }

    const productIds = [];
    const collectionIds = [];

    rawLocalWishlist.forEach((item) => {
      // Ensure item.item is a string for map keys and $in query
      // Assuming `item` in rawLocalWishlist is an object like `{ item: 'id', itemType: 'Product' }`
      if (item.item && typeof item.item.toString === 'function') {
        if (item.itemType === 'Product') {
          productIds.push(item.item);
        } else if (item.itemType === 'Collection') {
          collectionIds.push(item.item);
        }
      }
    });

    try {
      // Use the backend endpoint created for checking item existence (from cart store)
      const res = await axiosInstance.post('/cart/check-existence', { // Reusing cart's existence check
        productIds,
        collectionIds,
      });
      const { existingProductIds, existingCollectionIds } = res.data;

      const existingProductsSet = new Set(existingProductIds);
      const existingCollectionsSet = new Set(existingCollectionIds);

      const cleanedWishlist = rawLocalWishlist.filter((item) => {
        const itemIdString = item.item.toString(); // Convert ObjectId to string for comparison
        if (item.itemType === 'Product') {
          return existingProductsSet.has(itemIdString);
        } else if (item.itemType === 'Collection') {
          return existingCollectionsSet.has(itemIdString);
        }
        return false; // Should not happen for valid itemTypes
      });

      // Update local storage only if the wishlist was actually modified
      if (cleanedWishlist.length !== rawLocalWishlist.length) {
        saveLocalWishlist(cleanedWishlist);
        toast.success(
          'Some items in your wishlist were removed as they are no longer available.'
        );
      }
      return cleanedWishlist;
    } catch (error) {
      console.error('Error cleaning local wishlist:', error);
      toast.error(
        'Could not verify some wishlist items. Displaying wishlist as is.'
      );
      return rawLocalWishlist; // Return raw wishlist on error to avoid breaking functionality
    }
  },

  /**
   * Fetches the current user's or guest's wishlist from backend, or from local storage.
   */
  getwishlist: async () => {
    set({ isGettingWishlist: true });

      const { isAuthReady } = useAuthStore.getState();

    // Only proceed if auth status has been determined
    if (!isAuthReady) {
      console.warn('getWishlist called before auth is ready. Deferring...');
      set({ isGettingWishlist: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const wishlist = await fetchBackendWishlist();
        set({ wishlist });
        // Synchronize local storage after fetching from backend
        saveLocalWishlist(wishlist);
      } else {
        const cleanedLocalWishlist = await get().cleanAndGetLocalWishlist(); // Await the cleanup
        set({ wishlist: cleanedLocalWishlist });
      }
    } catch (error) {
      console.error('Error in getWishlist:', error);
      // If backend fetch fails for an identified user, fallback to local wishlist
      if (get()._isUserOrGuestIdentified()) {
        const fallbackWishlist = getLocalWishlist(); // Try to load from local storage as a fallback
        set({ wishlist: fallbackWishlist });
        toast.error('Failed to load wishlist from server. Showing local version.');
      } else {
        // For non-identified, cleanAndGetLocalWishlist already handles fallbacks
        set({ wishlist: getLocalWishlist() });
      }
    } finally {
      set({ isGettingWishlist: false });
    }
  },

  /**
   * Adds a product/collection to the wishlist.
   * @param {string} itemId - The ID of the item (product or collection) to add.
   * @param {string} itemType - 'Product' or 'Collection'. Required for backend.
   */
  addToWishlist: async (itemId, itemType) => {
    set({ isAddingToWishlist: true });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to add to wishlist.'
      );
      set({ isAddingToWishlist: false }); // Corrected state name
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentWishlist = get().wishlist || []; // Ensure it's an array for optimistic update
        const isAlreadyInWishlist = currentWishlist.some(
          (item) => item.item === itemId && item.itemType === itemType
        );

        if (isAlreadyInWishlist) {
          toast('Item already in wishlist.', { icon: 'ℹ️' });
          set({ isAddingToWishlist: false });
          return;
        }

        const optimisticWishlist = [
          ...currentWishlist,
          { item: itemId, itemType, _id: itemId + '-' + Date.now() }, // Add temp _id for consistency
        ];

        set({ wishlist: optimisticWishlist }); // Optimistic UI update
        saveLocalWishlist(optimisticWishlist); // Update local storage optimistically

        const res = await axiosInstance.put('/wishlist/add', {
          itemId,
          itemType,
        });
        toast.success('Item added to wishlist!');
        // Backend returns the actual updated wishlist, so we set it as the source of truth
        set({ wishlist: res.data.wishlist || [] });
      } else {
        // Use local storage if no user or guest session
        const currentLocalWishlist = getLocalWishlist();

        // Check if item already exists in local storage (by item ID and type)
        const isAlreadyInLocalWishlist = currentLocalWishlist.some(
          (item) => item.item === itemId && item.itemType === itemType
        );

        if (!isAlreadyInLocalWishlist) {
          currentLocalWishlist.push({ item: itemId, itemType, _id: itemId + '-' + Date.now() }); // Store object with ID and type
          saveLocalWishlist(currentLocalWishlist);
          set({ wishlist: currentLocalWishlist }); // Directly update state
          toast.success('Item added to local wishlist!');
        } else {
          toast('Item already in local wishlist.', { icon: 'ℹ️' });
        }
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to add item to wishlist.';
      set({ wishlist: getLocalWishlist(), isAddingToWishlist: false }); // Rollback and show error
      toast.error(errorMessage);
    } finally {
      set({ isAddingToWishlist: false });
    }
  },

  /**
   * Removes a product/collection from the wishlist.
   * @param {string} itemId - The ID of the item (product or collection) to remove.
   * @param {string} itemType - 'Product' or 'Collection'. Required for backend.
   */
  removeFromwishlist: async (itemId, itemType) => {
    set({ isRemovingFromWishlist: true });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to remove from wishlist.'
      );
      set({ isRemovingFromWishlist: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentWishlist = get().wishlist || []; // Ensure it's an array for optimistic update
        const optimisticWishlist = currentWishlist.filter(
          (item) => !(item.item === itemId && item.itemType === itemType)
        );

        set({ wishlist: optimisticWishlist }); // Optimistic UI update
        saveLocalWishlist(optimisticWishlist); // Update local storage optimistically

        const res = await axiosInstance.put('/wishlist/remove', {
          itemId,
          itemType,
        });
        toast.success('Item removed from wishlist!');
        // Backend returns the actual updated wishlist, so we set it as the source of truth
        set({ wishlist: res.data.wishlist || [] });
      } else {
        // Use local storage if no user or guest session
        const currentLocalWishlist = getLocalWishlist();
        const initialLength = currentLocalWishlist.length;

        // Filter based on both itemId and itemType for accurate local removal
        const updatedLocalWishlist = currentLocalWishlist.filter(
          (item) => !(item.item === itemId && item.itemType === itemType)
        );

        if (updatedLocalWishlist.length === initialLength) {
          toast.error('Item not found in local wishlist.');
        } else {
          saveLocalWishlist(updatedLocalWishlist);
          set({ wishlist: updatedLocalWishlist }); // Directly update state
          toast.success('Item removed from local wishlist!');
        }
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      const errorMessage =
        error.response?.data?.message ||
        'Failed to remove item from wishlist.';
      set({ wishlist: getLocalWishlist(), isRemovingFromWishlist: false }); // Rollback and show error
      toast.error(errorMessage);
    } finally {
      set({ isRemovingFromWishlist: false });
    }
  },

  /**
   * Clears the entire wishlist.
   */
  clearWishlist: async () => {
    set({ isRemovingFromWishlist: true }); // Reusing for clear operation
    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentWishlist = get().wishlist || []; // Get current state for potential rollback
        set({ wishlist: [] }); // Optimistic UI update to empty
        saveLocalWishlist([]); // Clear local storage optimistically

        const res = await axiosInstance.delete('/wishlist/clear');
        toast.success('Wishlist cleared!');
        // Backend returns the actual updated wishlist, so we set it as the source of truth
        set({ wishlist: res.data.wishlist || [] });
      } else {
        // Use local storage if no user or guest session
        saveLocalWishlist([]); // Save an empty array
        set({ wishlist: [] }); // Directly update state
        toast.success('Local wishlist cleared!');
      }
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to clear wishlist.';
      set({ wishlist: getLocalWishlist(), isRemovingFromWishlist: false }); // Rollback and show error
      toast.error(errorMessage);
    } finally {
      set({ isRemovingFromWishlist: false });
    }
  },
}));
