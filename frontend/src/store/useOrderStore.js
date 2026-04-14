import { create } from 'zustand';
import {axiosInstance} from '../lib/axios';

export const useOrderStore = create((set, get) => ({
  // State
  orders: [],
  currentOrder: null,
  isLoading: false,
  isCreatingOrder: false,
  error: null,

  // Actions
  createOrder: async (orderData) => {
    set({ isCreatingOrder: true, error: null });

    try {
      const response = await axiosInstance.post('/orders/create', orderData);

      if (response.data.success) {
        set({
          currentOrder: response.data.order,
          isCreatingOrder: false,
          error: null
        });
        return response.data.order;
      }
    } catch (error) {
      set({
        isCreatingOrder: false,
        error: error.response?.data?.message || 'Failed to create order'
      });
      throw error;
    }
  },

  getMyOrders: async (page = 1, limit = 10) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axiosInstance.get(`/orders/my-orders?page=${page}&limit=${limit}`);

      if (response.data.success) {
        set({
          orders: response.data.orders,
          isLoading: false,
          error: null
        });
        return response.data;
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to fetch orders'
      });
      throw error;
    }
  },

  getOrderById: async (orderId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axiosInstance.get(`/orders/${orderId}`);

      if (response.data.success) {
        set({
          currentOrder: response.data.order,
          isLoading: false,
          error: null
        });
        return response.data.order;
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to fetch order'
      });
      throw error;
    }
  },

  trackOrder: async (orderNumber, email) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axiosInstance.get(`/orders/track/${orderNumber}?email=${encodeURIComponent(email)}`);

      if (response.data.success) {
        set({
          currentOrder: response.data.order,
          isLoading: false,
          error: null
        });
        return response.data.order;
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to track order'
      });
      throw error;
    }
  },

  clearCurrentOrder: () => {
    set({ currentOrder: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  }
}));
