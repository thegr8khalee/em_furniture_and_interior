// src/store/useCartStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast'; // Assuming you have react-hot-toast installed
import Cookies from 'js-cookie'; // Import js-cookie
import { useAuthStore } from './useAuthStore.js';

const LOCAL_STORAGE_CART_KEY = 'localCart';

// Helper to get cart from local storage
const getLocalCart = () => {
  try {
    const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
    return storedCart ? JSON.parse(storedCart) : { items: [], totalPrice: 0 };
  } catch (error) {
    console.error('Error parsing local storage cart:', error);
    return { items: [], totalPrice: 0 }; // Return empty cart on error
  }
};

// Helper to save cart to local storage
const saveLocalCart = (cart) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving local storage cart:', error);
  }
};

// Helper to calculate total price for local cart
const calculateLocalCartTotal = (items) => {
  // This is a simplified calculation. In a real app, you'd need product prices.
  // For now, it just counts items. You'll need to fetch product data to calculate real prices.
  return items.reduce((total, item) => total + (item.quantity || 0), 0);
};

export const useCartStore = create((set, get) => ({
  cart: null,
  isGettingCart: false,
  isAddingToCart: false,
  isRemovingFromCart: false,

  _isUserOrGuestIdentified: () => {
    const authUser = useAuthStore.getState().authUser;
    const anonymousId = Cookies.get('anonymousId');
    return !!authUser || !!anonymousId;
  },

  getCart: async () => {
    set({ isGettingCart: true });
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.get('/cart');
        set({ cart: res.data.cart });
        // toast.success('Cart loaded successfully!'); // Can be noisy
      } catch (error) {
        console.error('Error loading cart from backend:', error);
        toast.error(error.message);
      } finally {
        set({ isGettingCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const localCart = getLocalCart();
      set({ cart: localCart, isGettingCart: false });
      toast.success('Local cart loaded!'); // Can be noisy
    }
  },

  addToCart: async (itemId, quantity = 1, itemType) => {
    set({ isAddingToCart: true });
    if (!itemType) {
      toast.error('Item type (Product/Collection) is required to add to cart.');
      set({ isAddingToCart: false });
      return;
    }

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.put('/cart/add', {
          itemId,
          quantity,
        });
        set({ cart: res.data.cart });
        toast.success('Item added to cart!');
      } catch (error) {
        console.error('Error adding to cart (backend):', error);

        toast.error(error.message);
      } finally {
        set({ isAddingToCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalCart = getLocalCart();
      const existingItemIndex = currentLocalCart.items.findIndex(
        (item) => item.item === itemId && item.itemType === itemType
      );

      if (existingItemIndex > -1) {
        currentLocalCart.items[existingItemIndex].quantity += quantity;
      } else {
        currentLocalCart.items.push({ item: itemId, itemType, quantity });
      }
      currentLocalCart.totalPrice = calculateLocalCartTotal(
        currentLocalCart.items
      ); // Update total
      saveLocalCart(currentLocalCart);
      set({ cart: currentLocalCart, isAddingToCart: false });
      toast.success('Item added to local cart!');
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

    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.put('/cart/remove', {
          itemId,
        }); // Pass itemType
        set({ cart: res.data.cart });
        toast.success('Item removed from cart!');
      } catch (error) {
        console.error('Error removing from cart (backend):', error);

        toast.error(error.message);
      } finally {
        set({ isRemovingFromCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const currentLocalCart = getLocalCart();
      const initialLength = currentLocalCart.items.length;
      currentLocalCart.items = currentLocalCart.items.filter(
        (item) => !(item.item === itemId && item.itemType === itemType)
      );

      if (currentLocalCart.items.length === initialLength) {
        toast.error('Item not found in local cart.');
      } else {
        currentLocalCart.totalPrice = calculateLocalCartTotal(
          currentLocalCart.items
        ); // Update total
        saveLocalCart(currentLocalCart);
        set({ cart: currentLocalCart, isRemovingFromCart: false });
        toast.success('Item removed from local cart!');
      }
    }
  },

  clearCart: async () => {
    set({ isRemovingFromCart: true }); // Reusing isRemovingFromCart for simplicity
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.delete('/cart/clear');
        set({ cart: res.data.cart || { items: [], totalPrice: 0 } });
        toast.success('Cart cleared!');
      } catch (error) {
        console.error('Error clearing cart (backend):', error);
        toast.error(error.message);
      } finally {
        set({ isRemovingFromCart: false });
      }
    } else {
      // Use local storage if no user or guest session
      const emptyLocalCart = { items: [], totalPrice: 0 };
      saveLocalCart(emptyLocalCart);
      set({ cart: emptyLocalCart, isRemovingFromCart: false });
      toast.success('Local cart cleared!');
    }
  },
}));
