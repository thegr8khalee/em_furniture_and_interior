// src/store/useCartStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useAuthStore } from './useAuthStore.js';

// Key for local storage cart
const LOCAL_STORAGE_CART_KEY = 'localCart';

const SESSION_STORAGE_CART_KEY = 'sessionCart'; // New key for session storage

// Helper to get cart from local storage or session storage based on consent
const getLocalCart = () => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      // If consent is accepted, prioritize localStorage
      const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (storedCart) return JSON.parse(storedCart);
    }

    // Always check sessionStorage as a fallback or if consent is not given for persistence
    const sessionCart = sessionStorage.getItem(SESSION_STORAGE_CART_KEY);
    return sessionCart ? JSON.parse(sessionCart) : [];
  } catch (error) {
    console.error('Error parsing local/session storage cart:', error);
    // Fallback to trying the other storage if one fails, or return empty
    try {
      const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (storedCart) return JSON.parse(storedCart);
    } catch (e) {
      console.error('Fallback to localStorage also failed:', e);
    }
    try {
      const sessionCart = sessionStorage.getItem(SESSION_STORAGE_CART_KEY);
      if (sessionCart) return JSON.parse(sessionCart);
    } catch (e) {
      console.error('Fallback to sessionStorage also failed:', e);
    }
    return []; // Return empty array if all fails
  }
};

// Helper to save cart to local storage or session storage based on consent
const saveLocalCart = (cart) => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      // If consent is accepted, save to localStorage and clear sessionStorage
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
      sessionStorage.removeItem(SESSION_STORAGE_CART_KEY); // Clear session storage if persistent is used
    } else {
      // If consent is false or not given, save to sessionStorage and clear localStorage
      sessionStorage.setItem(SESSION_STORAGE_CART_KEY, JSON.stringify(cart));
      localStorage.removeItem(LOCAL_STORAGE_CART_KEY); // Ensure persistent storage is cleared
    }
  } catch (error) {
    console.error('Error saving local/session storage cart:', error);
  }
};

export const useCartStore = create((set, get) => ({
  // FIX: Initialize cart to an empty array, matching backend's expected structure
  cart: [],
  isGettingCart: false,
  isAddingToCart: false,
  isRemovingFromCart: false,
  isUpdatingCartItem: false,
  cartError: null,

  cleanAndGetLocalCart: async () => {
    const rawLocalCart = getLocalCart();
    if (rawLocalCart.length === 0) {
      return []; // Nothing to clean
    }

    const productIds = [];
    const collectionIds = [];

    rawLocalCart.forEach((item) => {
      if (item.itemType === 'Product') {
        productIds.push(item.item); // Assuming item.item is the ID
      } else if (item.itemType === 'Collection') {
        collectionIds.push(item.item); // Assuming item.item is the ID
      }
    });

    try {
      const res = await axiosInstance.post('/cart/check-existence', {
        productIds,
        collectionIds,
      });
      const { existingProductIds, existingCollectionIds } = res.data;

      const existingProductsSet = new Set(existingProductIds);
      const existingCollectionsSet = new Set(existingCollectionIds);

      const cleanedCart = rawLocalCart.filter((item) => {
        if (item.itemType === 'Product') {
          return existingProductsSet.has(item.item);
        } else if (item.itemType === 'Collection') {
          return existingCollectionsSet.has(item.item);
        }
        return false; // Should not happen for valid itemTypes
      });

      // Update local storage only if the cart was actually modified
      if (cleanedCart.length !== rawLocalCart.length) {
        saveLocalCart(cleanedCart);
        toast.success(
          'Some items in your cart were removed as they are no longer available.'
        );
      }
      return cleanedCart;
    } catch (error) {
      console.error('Error cleaning local cart:', error);
      toast.error('Could not verify some cart items. Displaying cart as is.');
      return rawLocalCart; // Return raw cart on error to avoid breaking functionality
    }
  },

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

  /**
   * Fetches the current user's or guest's cart from backend, or from local storage.
   */
  getCart: async () => {
    set({ isGettingCart: true });

    const { isAuthReady } = useAuthStore.getState();

    // Only proceed if auth status has been determined
    if (!isAuthReady) {
      // If auth is not ready, defer the call or handle appropriately
      console.warn('getCart called before auth is ready. Deferring...');
      set({ isGettingCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.get('/cart');
        // The backend's /cart endpoint now returns the already cleaned cart
        set({ cart: res.data.cart || [] });
      } catch (error) {
        console.error('Error loading cart from backend:', error);
        toast.error('Failed to load cart. Please try again.');
        // Consider handling logout or other error states here if authentication fails
      } finally {
        set({ isGettingCart: false });
      }
    } else {
      // Use local storage and clean it before setting
      try {
        const cleanedLocalCart = await get().cleanAndGetLocalCart(); // Await the cleanup
        set({ cart: cleanedLocalCart });
      } catch (error) {
        console.log(error.message);
        set({ cart: getLocalCart() }); // Fallback to raw local cart
      } finally {
        set({ isGettingCart: false });
      }
    }
  },

  /**
   * Adds a product to the cart.
   * @param {string} productId - The ID of the product to add.
   * @param {number} quantity - The quantity to add (defaults to 1).
   * @param {string} itemType - 'Product' or 'Collection'
   */
  addToCart: async (productId, quantity = 1, itemType) => {
    set({ isAddingToCart: true, cartError: null });
    if (!itemType) {
      toast.error('Item type (Product/Collection) is required to add to cart.');
      set({ isAddingToCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        await axiosInstance.put('/cart/add', {
          itemId: productId,
          quantity,
          itemType,
        });
        // FIX: Assume backend returns an object { cart: [...] }
        toast.success('Item added to cart!');
        await get().getCart(); // Re-fetch cart after successful operation
      } catch (error) {
        console.error('Error adding to cart (backend):', error);
        const errorMessage =
          error.response?.data?.message || 'Failed to add item to cart.';
        set({ cartError: errorMessage });
        toast.error(errorMessage);
      } finally {
        set({ isAddingToCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalCart = getLocalCart();
      const existingItemIndex = currentLocalCart.findIndex(
        (item) => item.item === productId && item.itemType === itemType
      );

      if (existingItemIndex > -1) {
        currentLocalCart[existingItemIndex].quantity += quantity;
      } else {
        // For local storage, we generate a temporary _id to match backend structure for rendering
        currentLocalCart.push({
          item: productId,
          itemType,
          quantity,
          _id: productId + '-' + Date.now(),
        });
      }
      saveLocalCart(currentLocalCart);
      toast.success('Item added to local cart!');
      await get().getCart(); // Re-fetch cart after successful operation
      set({ isAddingToCart: false });
    }
  },

  /**
   * Removes a product from the cart.
   * @param {string} productId - The ID of the product to remove.
   * @param {string} itemType - 'Product' or 'Collection'
   */
  removeFromCart: async (productId, itemType) => {
    set({ isRemovingFromCart: true, cartError: null });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to remove from cart.'
      );
      set({ isRemovingFromCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        await axiosInstance.put('/cart/remove', {
          itemId: productId,
          itemType,
        });
        // FIX: Assume backend returns an object { cart: [...] }
        toast.success('Item removed from cart!');
        await get().getCart(); // Re-fetch cart after successful operation
      } catch (error) {
        console.error('Error removing from cart (backend):', error);
        const errorMessage =
          error.response?.data?.message || 'Failed to remove item from cart.';
        set({ cartError: errorMessage });
        toast.error(errorMessage);
      } finally {
        set({ isRemovingFromCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalCart = getLocalCart();
      const initialLength = currentLocalCart.length;
      const updatedLocalCart = currentLocalCart.filter(
        (item) => !(item.item === productId && item.itemType === itemType)
      );

      if (updatedLocalCart.length === initialLength) {
        toast.error('Item not found in local cart.');
      } else {
        saveLocalCart(updatedLocalCart);
        toast.success('Item removed from local cart!');
        await get().getCart(); // Re-fetch cart after successful operation
        set({ isRemovingFromCart: false });
      }
    }
  },

  /**
   * Clears the entire cart.
   */
  clearCart: async () => {
    set({ isRemovingFromCart: true, cartError: null }); // Reusing isRemovingFromCart for simplicity
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        await axiosInstance.delete('/cart/clear');
        // FIX: Assume backend returns an object { cart: [...] }
        toast.success('Cart cleared!');
        await get().getCart(); // Re-fetch cart after successful operation
      } catch (error) {
        console.error('Error clearing cart (backend):', error);
        const errorMessage =
          error.response?.data?.message || 'Failed to clear cart.';
        set({ cartError: errorMessage });
        toast.error(errorMessage);
      } finally {
        set({ isRemovingFromCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const emptyLocalCart = []; // Empty array
      saveLocalCart(emptyLocalCart);
      toast.success('Local cart cleared!');
      await get().getCart(); // Re-fetch cart after successful operation
      set({ isRemovingFromCart: false });
    }
  },

  /**
   * Action to update quantity of an item in the cart.
   * @param {string} itemId - The ID of the item to update.
   * @param {string} itemType - 'Product' or 'Collection'.
   * @param {number} newQuantity - The new quantity for the item.
   */
  updateCartItemQuantity: async (itemId, itemType, newQuantity) => {
    set({ isUpdatingCartItem: true, cartError: null });

    if (newQuantity < 1) {
      // If quantity drops to 0 or less, remove the item instead
      await get().removeFromCart(itemId, itemType);
      set({ isUpdatingCartItem: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      try {
        await axiosInstance.put('/cart/updatequantity', {
          itemId,
          itemType,
          quantity: newQuantity,
        });
        // FIX: Assume backend returns an object { cart: [...] }
        // toast.success('Cart item quantity updated!');
        await get().getCart(); // Re-fetch cart after successful operation
      } catch (error) {
        console.error('Error updating cart item quantity (backend):', error);
        // toast.error(error.message);
      } finally {
        set({ isUpdatingCartItem: false });
      }
    } else {
      // Local storage logic
      const currentLocalCart = getLocalCart();
      const itemIndex = currentLocalCart.findIndex(
        (item) => item.item === itemId && item.itemType === itemType
      );

      if (itemIndex > -1) {
        currentLocalCart[itemIndex].quantity = newQuantity;
        saveLocalCart(currentLocalCart);
        // toast.success('Local cart item quantity updated!');
        await get().getCart(); // Re-fetch cart after successful operation
        set({ isUpdatingCartItem: false });
      } else {
        // toast.error('Item not found in local cart to update.');
        set({ isUpdatingCartItem: false });
      }
    }
  },
}));
