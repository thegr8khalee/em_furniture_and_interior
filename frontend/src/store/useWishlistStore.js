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

  cleanAndGetLocalWishlist: async () => {
    const rawLocalWishlist = getLocalWishlist();
    if (rawLocalWishlist.length === 0) {
      return []; // Nothing to clean
    }

    const productIds = [];
    const collectionIds = [];

    rawLocalWishlist.forEach((item) => {
      // Ensure item.item is a string for map keys and $in query
      if (item.item && typeof item.item.toString === 'function') {
        if (item.itemType === 'Product') {
          productIds.push(item.item);
        } else if (item.itemType === 'Collection') {
          collectionIds.push(item.item);
        }
      }
    });

    try {
      // Use the backend endpoint created for checking item existence
      const res = await axiosInstance.post('/cart/check-existence', {
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
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.get('/wishlist');
        // The backend's /wishlist endpoint now returns the already cleaned wishlist
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
      // Use local storage and clean it before setting
      try {
        const cleanedLocalWishlist = await get().cleanAndGetLocalWishlist(); // Await the cleanup
        set({ wishlist: cleanedLocalWishlist });
      } catch (error) {
        console.log(error.message);
        // Error already logged/toasted by cleanAndGetLocalWishlist
        set({ wishlist: getLocalWishlist() }); // Fallback to raw local wishlist
      } finally {
        set({ isGettingWishlist: false });
      }
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
