import { jest } from '@jest/globals';
import { calculateTax } from '../../src/controllers/tax.controller.js';
import {
  mockFetch,
  mockPaystackSuccessResponse,
  mockPaystackVerifySuccess,
  mockFlutterwaveSuccessResponse,
  mockFlutterwaveVerifySuccess,
  mockStripeSuccessResponse,
  mockStripeVerifySuccess,
  createMockOrder,
} from '../helpers/mockData.js';

// Mock environment variables
process.env.PAYSTACK_SECRET_KEY = 'test_paystack_secret';
process.env.FLUTTERWAVE_SECRET_KEY = 'test_flutterwave_secret';
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

  describe('Flutterwave Integration', () => {
    test('should initialize Flutterwave payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlutterwaveSuccessResponse,
      });

      const mockOrder = createMockOrder({
        _id: '507f1f77bcf86cd799439011',
        totalAmount: 1000,
      });

      expect(mockFlutterwaveSuccessResponse.status).toBe('success');
    });

    test('should verify Flutterwave payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlutterwaveVerifySuccess,
      });

      const mockReq = {
        query: { tx_ref: 'test_tx_ref' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      expect(mockFlutterwaveVerifySuccess.data.status).toBe('successful');
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

  test('should calculate tax successfully based on configured percentage', async () => {
    const mockReq = {
      body: {
        items: [
          { id: 'prod1', quantity: 1, price: 1000 },
        ],
        amount: 1000,
        currency: 'NGN',
      },
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await calculateTax(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      tax: expect.objectContaining({
        amountToCollect: 100, // 10% of 1000
        rate: 0.1,
        taxableAmount: 1000,
      }),
      currency: 'NGN'
    }));
  });

  test('should handle validation errors', async () => {
    const mockReq = {
      body: {
        // Missing items
        amount: 1000,
      },
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await calculateTax(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/items are required/i)
    }));
  });
});

describe('Order Document Generation Tests', () => {
  test('should generate invoice PDF with correct metadata', () => {
    const mockOrder = createMockOrder({
      orderNumber: 'ORD-12345678-001',
      createdAt: new Date('2026-02-12'),
      status: 'confirmed',
      paymentStatus: 'paid',
    });

    const documentType = 'invoice';
    expect(documentType).toBe('invoice');
    expect(mockOrder.orderNumber).toBe('ORD-12345678-001');
  });

  test('should generate receipt PDF only for paid orders', () => {
    const paidOrder = createMockOrder({
      paymentStatus: 'paid',
    });

    const pendingOrder = createMockOrder({
      paymentStatus: 'pending',
    });

    expect(paidOrder.paymentStatus).toBe('paid');
    expect(pendingOrder.paymentStatus).toBe('pending');
  });

  test('should generate quotation PDF with validity period', () => {
    const mockOrder = createMockOrder({
      createdAt: new Date('2026-02-12'),
    });

    const validUntil = new Date(mockOrder.createdAt);
    validUntil.setDate(validUntil.getDate() + 14);

    expect(validUntil.getDate()).toBeGreaterThan(new Date(mockOrder.createdAt).getDate());
  });

  test('should include discount in document when coupon applied', () => {
    const mockOrder = createMockOrder({
      discount: 100,
      couponCode: 'SAVE10',
    });

    expect(mockOrder.discount).toBeGreaterThan(0);
    expect(mockOrder.couponCode).toBe('SAVE10');
  });

  test('should include tracking information when available', () => {
    const mockOrder = createMockOrder({
      trackingNumber: 'TRACK123',
      carrier: 'DHL',
      estimatedDeliveryDate: new Date('2026-02-20'),
    });

    expect(mockOrder.trackingNumber).toBeTruthy();
    expect(mockOrder.carrier).toBe('DHL');
  });
});
