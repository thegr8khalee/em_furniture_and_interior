import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
// import { Collection } from 'mongoose';

export const useCollectionStore = create((set, get) => ({
  collection: null,
  isGettingCollections: false,
  collections: [],
  currentPage: 0, // Current page loaded (0 means no pages loaded yet)
  hasMoreCollections: true, // Flag to indicate if more collections can be loaded
  currentCollectionFilters: {}, // Stores the filters currently applied to the fetched collections
  collectionsCount: null,

  getCollectionsCount: async () => {
    set({ isGettingCollections: true });

    try {
      const res = await axiosInstance.get('/collections/count');
      // console.log(res.data.totalCollections)
      set({ collectionsCount: res.data.totalCollections });
    } catch (error) {
      console.error('Error fetching collections count:', error);
    } finally {
      set({ isGettingCollections: false });
    }
  },

  /**
   * Fetches collections from the backend with pagination and filtering.
   * @param {number} page - The page number to fetch.
   * @param {number} limit - The number of items per page.
   * @param {object} filters - An object containing filter parameters.
   * @param {boolean} append - If true, new collections are appended; otherwise, they replace existing collections.
   */
  getCollections: async (page = 1, limit = 12, filters = {}, append = true) => {
  //  console.log('yes')
    const currentFilters = get().currentCollectionFilters;
    // Check if filters have genuinely changed to trigger a reset
    const filtersChanged =
      JSON.stringify(filters) !== JSON.stringify(currentFilters);

    // If filters changed, reset the collection list and start from page 1
    if (filtersChanged) {
      set({
        collections: [],
        currentPage: 0,
        hasMoreCollections: true,
        currentCollectionFilters: filters,
      });
      page = 1; // Ensure we fetch from page 1 for new filters
      append = false; // Always replace when filters change
    }

    // Prevent redundant fetches: if already loading, or no more collections AND filters haven't changed
    if (
      get().isGettingCollections ||
      (!get().hasMoreCollections && !filtersChanged)
    ) {
      return;
    }

    set({ isGettingCollections: true, collectionsError: null });

    try {
      // Construct query parameters from page, limit, and filters
      const queryParams = new URLSearchParams({
        page: page,
        limit: limit,
        ...filters,
      }).toString();

      const res = await axiosInstance.get(`/collections?${queryParams}`); // Assuming /collections endpoint
      const { collections: newCollections, hasMore } = res.data;

      set((state) => ({
        collections: append
          ? [...state.collections, ...newCollections]
          : newCollections,
        currentPage: page,
        hasMoreCollections: hasMore,
      }));
    } catch (error) {
      console.error('Error in getCollections store:', error);
      set({ collectionsError: error.message, hasMoreCollections: false }); // Stop further loading on error
      if (page === 1 && !append) {
        set({ collections: [] });
      }
    } finally {
      set({ isGettingCollections: false });
    }
  },

  /**
   * Resets the collections state, typically called when filters are cleared or view mode changes.
   */
  resetCollections: () =>
    set({
      collections: [],
      currentPage: 0,
      hasMoreCollections: true,
      currentCollectionFilters: {},
    }),

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
