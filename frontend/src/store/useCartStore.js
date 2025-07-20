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
    toast.error('Failed to load cart. Please try again.');
    throw error;
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
      } else {
        const cleanedLocalCart = await get().cleanAndGetLocalCart();
        set({ cart: cleanedLocalCart });
      }
    } catch (error) {
      console.error('Error in getCart:', error);
      if (!get()._isUserOrGuestIdentified()) {
        set({ cart: getLocalCart() });
      }
    } finally {
      set({ isGettingCart: false });
    }
  },

  addToCart: async (productId, quantity = 1, itemType) => {
    set({ isAddingToCart: true, cartError: null });
    if (!itemType) {
      toast.error('Item type (Product/Collection) is required to add to cart.');
      set({ isAddingToCart: false });
      return;
    }

    try {
      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.put('/cart/add', {
          itemId: productId,
          quantity,
          itemType,
        });
        toast.success('Item added to cart!');
        const cart = await fetchBackendCart();
        set({ cart });
      } else {
        const currentLocalCart = getLocalCart();
        const existingItemIndex = currentLocalCart.findIndex(
          (item) => item.item === productId && item.itemType === itemType
        );

        if (existingItemIndex > -1) {
          currentLocalCart[existingItemIndex].quantity += quantity;
        } else {
          currentLocalCart.push({
            item: productId,
            itemType,
            quantity,
            _id: productId + '-' + Date.now(),
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
    } finally {
      set({ isAddingToCart: false });
    }
  },

  removeFromCart: async (productId, itemType) => {
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
        await axiosInstance.put('/cart/remove', {
          itemId: productId,
          itemType,
        });
        toast.success('Item removed from cart!');
        const cart = await fetchBackendCart();
        set({ cart });
      } else {
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
          set({ cart: updatedLocalCart });
        }
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to remove item from cart.';
      set({ cartError: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  clearCart: async () => {
    set({ isRemovingFromCart: true, cartError: null });
    try {
      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.delete('/cart/clear');
        toast.success('Cart cleared!');
        set({ cart: [] });
      } else {
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
      if (get()._isUserOrGuestIdentified()) {
        await axiosInstance.put('/cart/updatequantity', {
          itemId,
          itemType,
          quantity: newQuantity,
        });
        const cart = await fetchBackendCart();
        set({ cart });
      } else {
        const currentLocalCart = getLocalCart();
        const itemIndex = currentLocalCart.findIndex(
          (item) => item.item === itemId && item.itemType === itemType
        );

        if (itemIndex > -1) {
          currentLocalCart[itemIndex].quantity = newQuantity;
          saveLocalCart(currentLocalCart);
          set({ cart: currentLocalCart });
        }
      }
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
    } finally {
      set({ isUpdatingCartItem: false });
    }
  },
}));