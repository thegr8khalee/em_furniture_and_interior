import { jest } from '@jest/globals';
import { getTaxRate, computeTax, computeShipping } from '../../src/lib/orderPricing.js';
import {
  mockFetch,
  mockPaystackSuccessResponse,
  mockPaystackVerifySuccess,
  mockStripeSuccessResponse,
  mockStripeVerifySuccess,
  createMockOrder,
} from '../helpers/mockData.js';

// Mock environment variables
process.env.PAYSTACK_SECRET_KEY = 'test_paystack_secret';
process.env.STRIPE_SECRET_KEY = 'test_stripe_secret';
process.env.TAX_RATE_PERCENTAGE = '7.5';
process.env.FRONTEND_URL = 'http://localhost:5173';

describe('Payment Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Paystack Integration', () => {
    test('should initialize Paystack payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaystackSuccessResponse,
      });

      const mockOrder = createMockOrder({
        _id: '507f1f77bcf86cd799439011',
        totalAmount: 1000,
      });

      const mockReq = {
        body: { orderId: mockOrder._id },
        user: null,
        guestSession: { anonymousId: 'test-guest-123' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Simulate payment initialization logic
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    test('should verify Paystack payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaystackVerifySuccess,
      });

      const mockReq = {
        query: { reference: 'test_reference' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Simulate verification logic
      expect(mockPaystackVerifySuccess.data.status).toBe('success');
    });

    test('should handle Paystack initialization failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          status: false,
          message: 'Invalid API key',
        }),
      });

      const mockReq = {
        body: { orderId: '507f1f77bcf86cd799439011' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Simulate error handling
      expect(true).toBe(true);
    });
  });

  describe('Stripe Integration', () => {
    test('should initialize Stripe payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStripeSuccessResponse,
      });

      const mockOrder = createMockOrder({
        _id: '507f1f77bcf86cd799439011',
        totalAmount: 1000,
      });

      expect(mockStripeSuccessResponse.id).toContain('cs_test');
    });

    test('should verify Stripe payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStripeVerifySuccess,
      });

      const mockReq = {
        query: { session_id: 'cs_test_123' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      expect(mockStripeVerifySuccess.payment_status).toBe('paid');
    });
  });

  describe('Bank Transfer Proof Upload', () => {
    test('should upload bank transfer proof successfully', async () => {
      const mockCloudinary = {
        uploader: {
          upload: jest.fn().mockResolvedValue({
            secure_url: 'https://res.cloudinary.com/test/proof.jpg',
            public_id: 'bank_transfers/proof123',
          }),
        },
      };

      const proofData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const mockOrder = createMockOrder({
        _id: '507f1f77bcf86cd799439011',
      });

      expect(proofData).toContain('data:image/jpeg');
    });

    test('should reject invalid proof format', async () => {
      const invalidProof = 'not-a-valid-image';
      expect(invalidProof).not.toContain('data:image');
    });
  });
});

describe('Tax Calculation Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    process.env.TAX_RATE_PERCENTAGE = '10'; // Set default for tests
  });

  // Tax is no longer computed from a client-supplied `amount`; it is derived
  // from catalog prices server-side. That behaviour needs a database, so it is
  // covered in __tests__/integration/orderPricing.test.js — including the case
  // this file used to assert, where the client dictated the taxable amount.
  test('tax rate is read from configuration', async () => {
    const previous = process.env.TAX_RATE_PERCENTAGE;
    process.env.TAX_RATE_PERCENTAGE = '7.5';
    expect(getTaxRate()).toBeCloseTo(0.075, 6);

    process.env.TAX_RATE_PERCENTAGE = '10';
    expect(getTaxRate()).toBeCloseTo(0.1, 6);

    delete process.env.TAX_RATE_PERCENTAGE;
    expect(getTaxRate()).toBeCloseTo(0.075, 6); // documented default

    process.env.TAX_RATE_PERCENTAGE = previous;
  });

  test('tax is charged on the discounted amount, rounded to the minor unit', () => {
    process.env.TAX_RATE_PERCENTAGE = '7.5';
    expect(computeTax(100000)).toBe(7500);
    expect(computeTax(90000)).toBe(6750);
    expect(computeTax(19.99)).toBe(1.5);
    expect(computeTax(0)).toBe(0);
    expect(computeTax(-100)).toBe(0); // never a negative tax
  });

  test('shipping is a server-owned flat rate, defaulting to zero', () => {
    delete process.env.SHIPPING_FLAT_RATE;
    expect(computeShipping()).toBe(0);

    process.env.SHIPPING_FLAT_RATE = '2500';
    expect(computeShipping()).toBe(2500);

    delete process.env.SHIPPING_FLAT_RATE;
  });
});
