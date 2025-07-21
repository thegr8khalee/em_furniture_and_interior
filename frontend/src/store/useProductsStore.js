import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';

export const useProductsStore = create((set, get) => ({
  products: [],
  isGettingProducts: false,
  product: null,
  currentPage: 0, // Current page loaded (0 means no pages loaded yet)
  hasMoreProducts: true, // Flag to indicate if more products can be loaded
  currentFilters: {}, // Stores the filters currently applied to the fetched products
  productsCount: null,

  getProductsCount: async () => {
    set({ isGettingProducts: true });

    try {
      const res = await axiosInstance.get('/products/count');
      set({ productsCount: res.data.totalProducts });
    } catch (error) {
      console.error('Error fetching products count:', error);
    } finally {
      set({ isGettingProducts: false });
    }
  },

  /**
   * Fetches products from the backend with pagination and filtering.
   * @param {number} page - The page number to fetch.
   * @param {number} limit - The number of items per page.
   * @param {object} filters - An object containing filter parameters (e.g., { search: 'query', minPrice: 100 }).
   * @param {boolean} append - If true, new products are appended; otherwise, they replace existing products.
   */
  getProducts: async (page = 1, limit = 12, filters = {}, append = true) => {
    const currentFilters = get().currentFilters;
    // Check if filters have genuinely changed to trigger a reset
    const filtersChanged =
      JSON.stringify(filters) !== JSON.stringify(currentFilters);

    // If filters changed, reset the product list and start from page 1
    if (filtersChanged) {
      set({
        products: [],
        currentPage: 0,
        hasMoreProducts: true,
        currentFilters: filters,
      });
      page = 1; // Ensure we fetch from page 1 for new filters
      append = false; // Always replace when filters change
    }

    // Prevent redundant fetches: if already loading, or no more products AND filters haven't changed
    if (
      get().isGettingProducts ||
      (!get().hasMoreProducts && !filtersChanged)
    ) {
      return;
    }

    set({ isGettingProducts: true, productsError: null });

    try {
      // Construct query parameters from page, limit, and filters
      const queryParams = new URLSearchParams({
        page: page,
        limit: limit,
        ...filters,
      }).toString();

      const res = await axiosInstance.get(`/products?${queryParams}`);
      const { products: newProducts, hasMore } = res.data;

      set((state) => ({
        products: append ? [...state.products, ...newProducts] : newProducts,
        currentPage: page,
        hasMoreProducts: hasMore,
      }));
    } catch (error) {
      console.error('Error in getProducts store:', error);
      set({ productsError: error.message, hasMoreProducts: false }); // Stop further loading on error
      // Optionally, clear products if an error occurs during initial load
      if (page === 1 && !append) {
        set({ products: [] });
      }
    } finally {
      set({ isGettingProducts: false });
    }
  },

  /**
   * Resets the products state, typically called when filters are cleared or view mode changes.
   */
  resetProducts: () =>
    set({
      products: [],
      currentPage: 0,
      hasMoreProducts: true,
      currentFilters: {},
    }),

  getProductById: async (Id) => {
    set({ isGettingProducts: true });
    try {
      const res = await axiosInstance.get(`/products/${Id}`);
      set({ product: res.data });
      return res.data;
    } catch (error) {
      console.log('Error in getProductbyID store:', error);
    } finally {
      set({ isGettingProducts: false });
    }
  },
}));
