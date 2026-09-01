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

// Helper to get explicit cookie consent status
const getConsentStatus = () => {
  const consentValue = localStorage.getItem('cookie_consent_accepted');
  return {
    hasResponded: consentValue !== null, // User has made a choice
    isAccepted: consentValue === 'true'  // User explicitly accepted
  };
};

// Helper to get cart from appropriate storage
const getLocalCart = () => {
  try {
    const { isAccepted } = getConsentStatus();
    
    if (isAccepted) {
      const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      if (storedCart) return JSON.parse(storedCart);
    }

    // Default to session storage for all other cases
    const sessionCart = sessionStorage.getItem(SESSION_STORAGE_CART_KEY);
    return sessionCart ? JSON.parse(sessionCart) : [];
  } catch (error) {
    console.error('Error parsing cart from storage:', error);
    // Fallback to empty array if all attempts fail
    return [];
  }
};

// Helper to save cart to appropriate storage
const saveLocalCart = (cart) => {
  try {
    const { isAccepted } = getConsentStatus();

    if (isAccepted) {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
      sessionStorage.removeItem(SESSION_STORAGE_CART_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_CART_KEY, JSON.stringify(cart));
      localStorage.removeItem(LOCAL_STORAGE_CART_KEY);
    }
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

// Helper function to fetch cart from backend
const fetchBackendCart = async () => {
  try {
    const res = await axiosInstance.get('/cart');
    return res.data.cart || [];
  } catch (error) {
    console.error('Error loading cart from backend:', error);
    throw error;
  }
};

// Migration function to ensure proper storage location
const migrateCartStorage = () => {
  const { isAccepted } = getConsentStatus();
  const hasLocalCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY) !== null;
  
  if (!isAccepted && hasLocalCart) {
    try {
      const cartData = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      sessionStorage.setItem(SESSION_STORAGE_CART_KEY, cartData);
      localStorage.removeItem(LOCAL_STORAGE_CART_KEY);
      console.log('Migrated cart from localStorage to sessionStorage');
    } catch (error) {
      console.error('Error migrating cart storage:', error);
    }
  }
};

// Run migration on store initialization
migrateCartStorage();

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

      const cleanedCart = rawLocalCart.filter((item) => {
        if (item.itemType === 'Product') {
          return existingProductIds.includes(item.item);
        } else if (item.itemType === 'Collection') {
          return existingCollectionIds.includes(item.item);
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
        saveLocalCart(cart);
      } else {
        const cleanedLocalCart = await get().cleanAndGetLocalCart();
        set({ cart: cleanedLocalCart });
      }
    } catch (error) {
      console.error('Error in getCart:', error);
      if (get()._isUserOrGuestIdentified()) {
        const fallbackCart = getLocalCart();
        set({ cart: fallbackCart });
        toast.error('Failed to load cart from server. Showing local version.');
      } else {
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
      const currentCart = get().cart;
      const existingItemIndex = currentCart.findIndex(
        (item) => item.item === itemId && item.itemType === itemType
      );

      // Optimistic update
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
            _id: `${itemId}-${Date.now()}`,
          },
        ];
      }

      set({ cart: optimisticCart });
      saveLocalCart(optimisticCart);

      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.put('/cart/add', {
          itemId,
          quantity,
          itemType,
        });
        const serverCart = await fetchBackendCart();
        set({ cart: serverCart });
        saveLocalCart(serverCart);
      }

      toast.success('Item added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to add item to cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback
      const originalCart = getLocalCart();
      set({ cart: originalCart });
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
      const currentCart = get().cart;
      const optimisticCart = currentCart.filter(
        (item) => !(item.item === itemId && item.itemType === itemType)
      );

      set({ cart: optimisticCart });
      saveLocalCart(optimisticCart);

      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.put('/cart/remove', {
          itemId,
          itemType,
        });
        const serverCart = await fetchBackendCart();
        set({ cart: serverCart });
        saveLocalCart(serverCart);
      }

      toast.success('Item removed from cart!');
    } catch (error) {
      console.error('Error removing from cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to remove item from cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback
      const originalCart = getLocalCart();
      set({ cart: originalCart });
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  clearCart: async () => {
    set({ isRemovingFromCart: true, cartError: null });
    try {
      set({ cart: [] });
      saveLocalCart([]);

      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.delete('/cart/clear');
        const serverCart = await fetchBackendCart();
        set({ cart: serverCart });
        saveLocalCart(serverCart);
      }

      toast.success('Cart cleared!');
    } catch (error) {
      console.error('Error clearing cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to clear cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);

      // Rollback
      const originalCart = getLocalCart();
      set({ cart: originalCart });
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  updateCartItemQuantity: async (itemId, itemType, newQuantity) => {
    set({ isUpdatingCartItem: true, cartError: null });

    if (newQuantity < 1) {
      await get().removeFromCart(itemId, itemType);
      set({ isUpdatingCartItem: false });
      return;
    }

    try {
      const currentCart = get().cart;
      const existingItemIndex = currentCart.findIndex(
        (item) => item.item === itemId && item.itemType === itemType
      );

      let optimisticCart = [...currentCart];
      if (existingItemIndex > -1) {
        optimisticCart[existingItemIndex] = {
          ...optimisticCart[existingItemIndex],
          quantity: newQuantity,
        };
      }

      set({ cart: optimisticCart });
      saveLocalCart(optimisticCart);

      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.put('/cart/updatequantity', {
          itemId,
          itemType,
          quantity: newQuantity,
        });
        const serverCart = await fetchBackendCart();
        set({ cart: serverCart });
        saveLocalCart(serverCart);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      // Rollback
      const originalCart = getLocalCart();
      set({ cart: originalCart });
    } finally {
      set({ isUpdatingCartItem: false });
    }
  },
}));