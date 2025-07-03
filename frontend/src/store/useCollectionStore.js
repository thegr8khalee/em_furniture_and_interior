import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';

export const useCollectionStore = create((set) => ({
  collections: [],
  isGettingCollections: true,

  getCollections: async () => {
    set({ isGettingCollections: true });
    try {
      const res = await axiosInstance.get('/collections');

      set({collections: res.data});
    } catch (error) {
      console.log('Error in getCollections store:', error);
      set({collections: null});
    } finally {
      set({ isGettingCollections: false });
    }
  },
}));
