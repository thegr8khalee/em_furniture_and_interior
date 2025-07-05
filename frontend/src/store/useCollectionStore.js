import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
// import { Collection } from 'mongoose';

export const useCollectionStore = create((set) => ({
  collection: null,
  isGettingCollections: true,
  collections: [],

  getCollections: async () => {
    set({ isGettingCollections: true });
    try {
      const res = await axiosInstance.get('/collections');
      set({ collections: res.data });
    } catch (error) {
      console.log('Error in getCollections store:', error);
      set({ collections: null });
    } finally {
      set({ isGettingCollections: false });
    }
  },

  getCollectionById: async (Id) => {
    set({ isGettingCollections: true });
    try {
      const res = await axiosInstance.get(`/collections/${Id}`);
      set({ collection: res.data });
    //   console.log(res.data)
      return res.data;
    } catch (error) {
      console.log('Error in getCollectionbyID store:', error);
    } finally {
      set({ isGettingCollections: false });
    }
  },
}));
