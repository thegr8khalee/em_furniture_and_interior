// src/store/useCartStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useAuthStore } from './useAuthStore.js';

// Key for local storage cart
const LOCAL_STORAGE_CART_KEY = 'localCart';

// Helper to get cart from local storage
const getLocalCart = () => {
  try {
    const storedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
    // Local storage cart will now be an array of cart items, matching backend's expected structure
    return storedCart ? JSON.parse(storedCart) : [];
  } catch (error) {
    console.error('Error parsing local storage cart:', error);
    return []; // Return empty array on error
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

export const useCartStore = create((set, get) => ({
  // FIX: Initialize cart to an empty array, matching backend's expected structure
  cart: [],
  isGettingCart: false,
  isAddingToCart: false,
  isRemovingFromCart: false,
  isUpdatingCartItem: false,
  cartError: null,

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
   * Fetches the current user's or guest's cart from backend, or from local storage.
   */
  getCart: async () => {
    set({ isGettingCart: true });
    if (get()._isUserOrGuestIdentified()) {
      // Use backend if user is authenticated or has a guest session
      try {
        const res = await axiosInstance.get('/cart');
        // FIX: Assume backend returns an object { cart: [...] } where cart is the array of items
        // If backend returns just the array directly, change to `set({ cart: res.data || [] });`
        set({ cart: res.data.cart || [] });
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
        await axiosInstance.put('/cart/update-quantity', {
          itemId,
          itemType,
          quantity: newQuantity,
        });
        // FIX: Assume backend returns an object { cart: [...] }
        toast.success('Cart item quantity updated!');
        await get().getCart(); // Re-fetch cart after successful operation
      } catch (error) {
        console.error('Error updating cart item quantity (backend):', error);
        toast.error(error.message);
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
        toast.success('Local cart item quantity updated!');
        await get().getCart(); // Re-fetch cart after successful operation
        set({ isUpdatingCartItem: false });
      } else {
        toast.error('Item not found in local cart to update.');
        set({ isUpdatingCartItem: false });
      }
    }
  },
}));
