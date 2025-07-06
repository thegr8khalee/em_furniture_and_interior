// src/store/useCartStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast'; // Assuming you have react-hot-toast installed

export const useCartStore = create((set) => ({
  cart: null,
  isGettingCart: false,
  isAddingToCart: false,
  isRemovingFromCart: false,

  getCart: async () => {
    set({ isGettingCart: true });
    try {
      const res = await axiosInstance.get('/cart');
      set({ cart: res.data });
      toast.success('Cart loaded successfully!');
    } catch (error) {
      console.error('Error loading cart:', error);
      toast.error(error.message);
    } finally {
      set({ isGettingCart: false });
    }
  },

  addToCart: async (itemId, quantity = 1) => {
    set({ isAddingToCart: true });
    try {
      // Assuming backend expects productId and quantity in the request body
      const res = await axiosInstance.put('/cart/add', { itemId, quantity });
      // Assuming backend returns the updated cart object in res.data.cart
      set({ cart: res.data.cart });
    //   console.log(res.data.cart)
      toast.success('Item added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error(error.message);
    } finally {
      set({ isAddingToCart: false });
    }
  },

  /**
   * Removes a product from the cart.
   * @param {string} productId - The ID of the product to remove.
   */
  removeFromCart: async (productId) => {
    set({ isRemovingFromCart: true });
    try {
      const res = await axiosInstance.put('/cart/remove', { productId });
      // Assuming backend returns the updated cart object in res.data.cart
      set({ cart: res.data.cart });
      toast.success('Item removed from cart!');
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast.error(error.message);
    } finally {
      set({ isRemovingFromCart: false });
    }
  },

  clearCart: async () => {
    set({ isRemovingFromCart: true, cartError: null });
    try {
      const res = await axiosInstance.delete('/cart/clear');
      set({ cart: res.data.cart || { items: [], totalPrice: 0 } });
      toast.success('Cart cleared!');
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error(error.message);
    } finally {
      set({ isRemovingFromCart: false });
    }
  },
}));
