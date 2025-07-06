// src/store/usewishlistStore.js
import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { toast } from 'react-hot-toast'; // Assuming you have react-hot-toast installed

export const useWishlistStore = create((set) => ({
  wishlist: null,
  isGettingwishlist: false,
  isAddingTowishlist: false,
  isRemovingFromwishlist: false,

  getwishlist: async () => {
    set({ isGettingwishlist: true });
    try {
      const res = await axiosInstance.get('/wishlist');
      set({ wishlist: res.data.wishlist });
      toast.success('wishlist loaded successfully!');
    } catch (error) {
      console.error('Error loading wishlist:', error);
      toast.error(error.message);
    } finally {
      set({ isGettingwishlist: false });
    }
  },

  addToWishlist: async (itemId, quantity = 1) => {
    set({ isAddingTowishlist: true });
    try {
      // Assuming backend expects productId and quantity in the request body
      const res = await axiosInstance.put('/wishlist/add', {
        itemId,
        quantity,
      });
      // Assuming backend returns the updated wishlist object in res.data.wishlist
      set({ wishlist: res.data.wishlist });
        console.log(res.data.wishlist)
      toast.success('Item added to wishlist!');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error(error.message);
    } finally {
      set({ isAddingTowishlist: false });
    }
  },

  /**
   * Removes a product from the wishlist.
   * @param {string} productId - The ID of the product to remove.
   */
  removeFromwishlist: async (itemId) => {
    set({ isRemovingFromwishlist: true });
    try {
      const res = await axiosInstance.put('/wishlist/remove', { itemId });
      // Assuming backend returns the updated wishlist object in res.data.wishlist
      set({ wishlist: res.data.wishlist });
      toast.success('Item removed from wishlist!');
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      toast.error(error.message);
    } finally {
      set({ isRemovingFromwishlist: false });
    }
  },

  clearwishlist: async () => {
    set({ isRemovingFromwishlist: true, wishlistError: null });
    try {
      const res = await axiosInstance.delete('/wishlist/clear');
      set({ wishlist: res.data.wishlist || { items: [], totalPrice: 0 } });
      toast.success('wishlist cleared!');
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      toast.error(error.message);
    } finally {
      set({ isRemovingFromwishlist: false });
    }
  },
}));
