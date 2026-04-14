import { jest } from '@jest/globals';

export const mockFetch = jest.fn();
global.fetch = mockFetch;

export const mockPaystackSuccessResponse = {
  status: true,
  message: 'Authorization URL created',
  data: {
    authorization_url: 'https://checkout.paystack.com/test123',
    access_code: 'test_access_code',
    reference: 'test_reference',
  },
};

export const mockPaystackVerifySuccess = {
  status: true,
  message: 'Verification successful',
  data: {
    id: 12345,
    domain: 'test',
    status: 'success',
    reference: 'test_reference',
    amount: 100000,
    message: null,
    gateway_response: 'Successful',
    paid_at: '2026-02-12T10:00:00.000Z',
    created_at: '2026-02-12T09:55:00.000Z',
    channel: 'card',
    currency: 'NGN',
    ip_address: '127.0.0.1',
    authorization: {},
    customer: {},
  },
};

export const mockFlutterwaveSuccessResponse = {
  status: 'success',
  message: 'Hosted Link',
  data: {
    link: 'https://ravemodal-dev.herokuapp.com/v3/hosted/pay/test123',
  },
};

export const mockFlutterwaveVerifySuccess = {
  status: 'success',
  message: 'Transaction fetched successfully',
  data: {
    id: 12345,
    tx_ref: 'test_tx_ref',
    flw_ref: 'FLW12345',
    amount: 1000,
    currency: 'NGN',
    charged_amount: 1000,
    status: 'successful',
    payment_type: 'card',
    created_at: '2026-02-12T09:55:00.000Z',
  },
};

export const mockStripeSuccessResponse = {
  id: 'cs_test_123',
  object: 'checkout.session',
  url: 'https://checkout.stripe.com/c/pay/test123',
  payment_status: 'unpaid',
  amount_total: 100000,
  currency: 'ngn',
};

export const mockStripeVerifySuccess = {
  id: 'cs_test_123',
  object: 'checkout.session',
  payment_status: 'paid',
  amount_total: 100000,
  currency: 'ngn',
};

export const mockCloudinaryResponse = {
  secure_url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
  public_id: 'test/test123',
  width: 800,
  height: 600,
};

export const cleanupDatabase = async (models) => {
  for (const model of models) {
    await model.deleteMany({});
  }
};

export const createMockOrder = (overrides = {}) => ({
  orderNumber: 'ORD-12345678-001',
  user: null,
  guest: null,
  isGuestOrder: true,
  items: [
    {
      item: '507f1f77bcf86cd799439011',
      itemType: 'Product',
      name: 'Test Product',
      imageUrl: 'https://example.com/image.jpg',
      price: 1000,
      quantity: 1,
      subtotal: 1000,
    },
  ],
  shippingAddress: {
    fullName: 'John Doe',
    phone: '+2341234567890',
    email: 'john@example.com',
    address: '123 Test St',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postalCode: '100001',
  },
  billingAddress: {
    fullName: 'John Doe',
    phone: '+2341234567890',
    email: 'john@example.com',
    address: '123 Test St',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postalCode: '100001',
  },
  useSameAddressForBilling: true,
  subtotal: 1000,
  discount: 0,
  couponCode: null,
  couponId: null,
  shippingCost: 0,
  taxAmount: 0,
  totalAmount: 1000,
  loyaltyPointsEarned: 0,
  loyaltyPointsCredited: false,
  status: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'whatsapp',
  trackingNumber: null,
  trackingUrl: null,
  carrier: null,
  estimatedDeliveryDate: null,
  deliveredAt: null,
  notes: '',
  adminNotes: '',
  statusHistory: [],
  ...overrides,
});
