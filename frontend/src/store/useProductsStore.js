import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';

export const useProductsStore = create((set) => ({
  products: [],
  isGettingProducts: false,
  product: null,

  getProducts: async () => {
    set({ isGettingProducts: true });
    try {
      const res = await axiosInstance.get('/products');

      set({products: res.data});
    } catch (error) {
      console.log('Error in getProducts store:', error);
      set({products: null});
    } finally {
      set({ isGettingProducts: false });
    }
  },

  getProductById: async (Id) => {
    set({ isGettingProducts: true });
    try {
      const res = await axiosInstance.get(`/products/${Id}`);
      set({product: res.data})
      return res.data;
    } catch (error) {
      console.log('Error in getProductbyID store:', error);
    } finally {
      set({ isGettingProducts: false });
    }
  },
}));
