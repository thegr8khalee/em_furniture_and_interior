/* eslint-disable no-unused-vars */
// src/store/useCartStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useAuthStore } from './useAuthStore.js';

// Key for local storage cart
const LOCAL_STORAGE_CART_KEY = 'localCart';
const SESSION_STORAGE_CART_KEY = 'sessionCart';

// Helper to get cart from local storage or session storage based on consent
const getLocalCart = () => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (storedCart) return JSON.parse(storedCart);
    }

    const sessionCart = sessionStorage.getItem(SESSION_STORAGE_CART_KEY);
    return sessionCart ? JSON.parse(sessionCart) : [];
  } catch (error) {
    console.error('Error parsing local/session storage cart:', error);
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
    return [];
  }
};

// Helper to save cart to local storage or session storage based on consent
const saveLocalCart = (cart) => {
  try {
    const consentAccepted =
      localStorage.getItem('cookie_consent_accepted') === 'true';

    if (consentAccepted) {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
      sessionStorage.removeItem(SESSION_STORAGE_CART_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_CART_KEY, JSON.stringify(cart));
      localStorage.removeItem(LOCAL_STORAGE_CART_KEY);
    }
  } catch (error) {
    console.error('Error saving local/session storage cart:', error);
  }
};

// Helper function to fetch cart from backend
const fetchBackendCart = async () => {
  try {
    const res = await axiosInstance.get('/cart');
    return res.data.cart || [];
  } catch (error) {
    console.error('Error loading cart from backend:', error);
    // Do NOT toast here, let the calling function handle it for initial load
    throw error; // Re-throw to allow calling function to catch and handle
  }
};

export const useCartStore = create((set, get) => ({
  cart: [],
  isGettingCart: false,
  isAddingToCart: false,
  isRemovingFromCart: false,
  isUpdatingCartItem: false,
  cartError: null,

  cleanAndGetLocalCart: async () => {
    const rawLocalCart = getLocalCart();
    if (rawLocalCart.length === 0) {
      return [];
    }

    const productIds = [];
    const collectionIds = [];

    rawLocalCart.forEach((item) => {
      if (item.itemType === 'Product') {
        productIds.push(item.item);
      } else if (item.itemType === 'Collection') {
        collectionIds.push(item.item);
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
        return false;
      });

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
      return rawLocalCart;
    }
  },

  _isUserOrGuestIdentified: () => {
    const { authUser, isAuthReady } = useAuthStore.getState();
    const anonymousId = Cookies.get('anonymousId');
    return isAuthReady && (!!authUser || !!anonymousId);
  },

  getCart: async () => {
    set({ isGettingCart: true });

    const { isAuthReady } = useAuthStore.getState();

    if (!isAuthReady) {
      console.warn('getCart called before auth is ready. Deferring...');
      set({ isGettingCart: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const cart = await fetchBackendCart();
        set({ cart });
        // After fetching from backend, ensure local storage is synchronized
        // This handles cases where user logs in or switches devices
        saveLocalCart(cart);
      } else {
        const cleanedLocalCart = await get().cleanAndGetLocalCart();
        set({ cart: cleanedLocalCart });
      }
    } catch (error) {
      console.error('Error in getCart:', error);
      // If backend fetch fails for an identified user, fallback to local cart
      if (get()._isUserOrGuestIdentified()) {
        const fallbackCart = getLocalCart(); // Try to load from local storage as a fallback
        set({ cart: fallbackCart });
        toast.error('Failed to load cart from server. Showing local version.');
      } else {
        // For non-identified, cleanAndGetLocalCart already handles fallbacks
        set({ cart: getLocalCart() });
      }
    } finally {
      set({ isGettingCart: false });
    }
  },

  addToCart: async (itemId, quantity = 1, itemType) => {
    set({ isAddingToCart: true, cartError: null });
    if (!itemType) {
      toast.error('Item type (Product/Collection) is required to add to cart.');
      set({ isAddingToCart: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentCart = get().cart; // Get current state for potential rollback
        const existingItemIndex = currentCart.findIndex(
          (item) => item.item === itemId && item.itemType === itemType
        );

        let optimisticCart;
        if (existingItemIndex > -1) {
          optimisticCart = [...currentCart];
          optimisticCart[existingItemIndex] = {
            ...optimisticCart[existingItemIndex],
            quantity: optimisticCart[existingItemIndex].quantity + quantity,
          };
        } else {
          optimisticCart = [
            ...currentCart,
            {
              item: itemId,
              itemType,
              quantity,
              _id: itemId + '-' + Date.now(), // Temp ID for optimistic update
            },
          ];
        }

        set({ cart: optimisticCart }); // Optimistic UI update
        saveLocalCart(optimisticCart); // Update local storage optimistically

        const res = await axiosInstance.put('/cart/add', {
          itemId,
          quantity,
          itemType,
        });
        toast.success('Item added to cart!');
        // Backend returns the actual updated cart, so we set it as the source of truth
        set({ cart: res.data.cart || [] });
      } else {
        // Local storage logic (already optimized)
        const currentLocalCart = getLocalCart();
        const existingItemIndex = currentLocalCart.findIndex(
          (item) => item.item === itemId && item.itemType === itemType
        );

        if (existingItemIndex > -1) {
          currentLocalCart[existingItemIndex].quantity += quantity;
        } else {
          currentLocalCart.push({
            item: itemId,
            itemType,
            quantity,
            _id: itemId + '-' + Date.now(),
          });
        }
        saveLocalCart(currentLocalCart);
        toast.success('Item added to local cart!');
        set({ cart: currentLocalCart });
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to add item to cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback for identified users if backend call fails
      if (get()._isUserOrGuestIdentified()) {
        const originalCart = getLocalCart(); // Fetch original from local storage
        set({ cart: originalCart });
        toast.error('Failed to add item to cart. Reverting changes.');
      }
    } finally {
      set({ isAddingToCart: false });
    }
  },

  removeFromCart: async (itemId, itemType) => {
    set({ isRemovingFromCart: true, cartError: null });
    if (!itemType) {
      toast.error(
        'Item type (Product/Collection) is required to remove from cart.'
      );
      set({ isRemovingFromCart: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentCart = get().cart; // Get current state for potential rollback
        const optimisticCart = currentCart.filter(
          (item) => !(item.item === itemId && item.itemType === itemType)
        );

        set({ cart: optimisticCart }); // Optimistic UI update
        saveLocalCart(optimisticCart); // Update local storage optimistically

        const res = await axiosInstance.put('/cart/remove', {
          itemId,
          itemType,
        });
        toast.success('Item removed from cart!');
        // Backend returns the actual updated cart, so we set it as the source of truth
        set({ cart: res.data.cart || [] });
      } else {
        // Local storage logic (already optimized)
        const currentLocalCart = getLocalCart();
        const initialLength = currentLocalCart.length;
        const updatedLocalCart = currentLocalCart.filter(
          (item) => !(item.item === itemId && item.itemType === itemType)
        );

        if (updatedLocalCart.length === initialLength) {
          toast.error('Item not found in local cart.');
        } else {
          saveLocalCart(updatedLocalCart);
          toast.success('Item removed from local cart!');
          set({ cart: updatedLocalCart });
        }
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to remove item from cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback for identified users if backend call fails
      if (get()._isUserOrGuestIdentified()) {
        const originalCart = getLocalCart(); // Fetch original from local storage
        set({ cart: originalCart });
        toast.error('Failed to remove item. Reverting changes.');
      }
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  clearCart: async () => {
    set({ isRemovingFromCart: true, cartError: null });
    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentCart = get().cart; // Get current state for potential rollback
        set({ cart: [] }); // Optimistic UI update to empty
        saveLocalCart([]); // Clear local storage optimistically

        const res = await axiosInstance.delete('/cart/clear');
        toast.success('Cart cleared!');
        // Backend returns the actual updated cart, so we set it as the source of truth
        set({ cart: res.data.cart || [] });
      } else {
        // Local storage logic (already optimized)
        saveLocalCart([]);
        toast.success('Local cart cleared!');
        set({ cart: [] });
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to clear cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback for identified users if backend call fails
      if (get()._isUserOrGuestIdentified()) {
        const originalCart = getLocalCart(); // Fetch original from local storage
        set({ cart: originalCart });
        toast.error('Failed to clear cart. Reverting changes.');
      }
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  updateCartItemQuantity: async (itemId, itemType, newQuantity) => {
    set({ isUpdatingCartItem: true, cartError: null });

    if (newQuantity < 1) {
      // If quantity drops to 0 or less, remove the item instead
      await get().removeFromCart(itemId, itemType);
      set({ isUpdatingCartItem: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        const currentCart = get().cart; // Get current state for potential rollback
        const existingItemIndex = currentCart.findIndex(
          (item) => item.item === itemId && item.itemType === itemType
        );

        let optimisticCart = [...currentCart];
        if (existingItemIndex > -1) {
          optimisticCart[existingItemIndex] = {
            ...optimisticCart[existingItemIndex],
            quantity: newQuantity,
          };
        } else {
          // This case should ideally not happen for quantity updates, but handle defensively
          optimisticCart.push({
            item: itemId,
            itemType,
            quantity: newQuantity,
            _id: itemId + '-' + Date.now(),
          });
        }

        set({ cart: optimisticCart }); // Optimistic UI update
        saveLocalCart(optimisticCart); // Update local storage optimistically

        const res = await axiosInstance.put('/cart/updatequantity', {
          itemId,
          itemType,
          quantity: newQuantity,
        });
        // toast.success('Cart item quantity updated!'); // Commented out to avoid excessive toasts
        // Backend returns the actual updated cart, so we set it as the source of truth
        set({ cart: res.data.cart || [] });
      } else {
        // Local storage logic (already optimized)
        const currentLocalCart = getLocalCart();
        const itemIndex = currentLocalCart.findIndex(
          (item) => item.item === itemId && item.itemType === itemType
        );

        if (itemIndex > -1) {
          currentLocalCart[itemIndex].quantity = newQuantity;
          saveLocalCart(currentLocalCart);
          // toast.success('Local cart item quantity updated!'); // Commented out
          set({ cart: currentLocalCart });
        } else {
          // toast.error('Item not found in local cart to update.'); // Commented out
        }
      }
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      // toast.error(error.message); // Commented out
      // Rollback for identified users if backend call fails
      if (get()._isUserOrGuestIdentified()) {
        const originalCart = getLocalCart(); // Fetch original from local storage
        set({ cart: originalCart });
        toast.error('Failed to update quantity. Reverting changes.');
      }
    } finally {
      set({ isUpdatingCartItem: false });
    }
  },
}));
