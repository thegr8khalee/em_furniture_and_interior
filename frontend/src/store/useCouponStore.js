import { create } from 'zustand';
import {axiosInstance} from '../lib/axios';

export const useCouponStore = create((set, get) => ({
  // State
  appliedCoupon: null,
  couponCode: '',
  discount: 0,
  isValidating: false,
  couponError: null,

  // Actions
  setCouponCode: (code) => {
    set({ couponCode: code.toUpperCase(), couponError: null });
  },

  validateCoupon: async (cartItems, subtotal) => {
    const { couponCode } = get();
    
    if (!couponCode || couponCode.trim() === '') {
      set({ couponError: 'Please enter a coupon code' });
      return;
    }

    set({ isValidating: true, couponError: null });

    try {
      const response = await axiosInstance.post('/coupons/validate', {
        code: couponCode,
        cartItems,
        subtotal
      });

      set({
        appliedCoupon: response.data.coupon,
        discount: response.data.discount,
        isValidating: false,
        couponError: null
      });
    } catch (error) {
      set({
        appliedCoupon: null,
        discount: 0,
        isValidating: false,
        couponError: error.response?.data?.message || 'Failed to validate coupon'
      });
    }
  },

  applyCoupon: async (code) => {
    set({ isValidating: true, couponError: null });

    try {
      const response = await axiosInstance.post('/coupons/apply', { code });

      if (response.data.success) {
        set({
          appliedCoupon: response.data.coupon,
          couponCode: code.toUpperCase(),
          isValidating: false,
          couponError: null
        });
      }
    } catch (error) {
      set({
        appliedCoupon: null,
        discount: 0,
        isValidating: false,
        couponError: error.response?.data?.message || 'Failed to apply coupon'
      });
    }
  },

  removeCoupon: () => {
    set({
      appliedCoupon: null,
      couponCode: '',
      discount: 0,
      couponError: null
    });
  },

  clearCouponError: () => {
    set({ couponError: null });
  }
}));
