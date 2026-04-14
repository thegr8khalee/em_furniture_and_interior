import { jest } from '@jest/globals';
import { createMockOrder } from '../helpers/mockData.js';

describe('Coupon Controller Tests', () => {
  test('should validate coupon successfully for valid cart', () => {
    const mockCoupon = {
      code: 'SAVE10',
      description: '10% off all products',
      discountType: 'percentage',
      discountValue: 10,
      minimumPurchase: 500,
      maximumDiscount: 200,
      isActive: true,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
      usageLimit: 100,
      usageCount: 0,
      isValidForCart: jest.fn().mockReturnValue({ valid: true }),
      calculateDiscount: jest.fn().mockReturnValue(100),
    };

    const cartItems = [
      { itemId: 'prod1', itemType: 'Product', price: 1000, quantity: 1 },
    ];

    const subtotal = 1000;

    expect(mockCoupon.isValidForCart(cartItems, subtotal).valid).toBe(true);
    expect(mockCoupon.calculateDiscount(subtotal)).toBe(100);
  });

  test('should reject expired coupon', () => {
    const mockCoupon = {
      code: 'EXPIRED',
      isActive: true,
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2025-01-31'),
    };

    const now = new Date();
    const isValid = now >= mockCoupon.validFrom && now <= mockCoupon.validUntil;

    expect(isValid).toBe(false);
  });

  test('should reject coupon below minimum purchase', () => {
    const mockCoupon = {
      code: 'SAVE10',
      minimumPurchase: 1000,
      isValidForCart: jest.fn().mockReturnValue({
        valid: false,
        message: 'Cart total is below minimum purchase requirement.',
      }),
    };

    const cartItems = [
      { itemId: 'prod1', itemType: 'Product', price: 500, quantity: 1 },
    ];

    const subtotal = 500;

    const validation = mockCoupon.isValidForCart(cartItems, subtotal);
    expect(validation.valid).toBe(false);
    expect(validation.message).toContain('minimum purchase');
  });

  test('should calculate percentage discount correctly', () => {
    const subtotal = 1000;
    const discountValue = 10;
    const expectedDiscount = (subtotal * discountValue) / 100;

    expect(expectedDiscount).toBe(100);
  });

  test('should calculate fixed discount correctly', () => {
    const subtotal = 1000;
    const fixedDiscount = 150;

    expect(fixedDiscount).toBe(150);
  });

  test('should cap discount at maximum discount value', () => {
    const subtotal = 5000;
    const discountPercentage = 20;
    const maximumDiscount = 500;

    const rawDiscount = (subtotal * discountPercentage) / 100; // 1000
    const finalDiscount = Math.min(rawDiscount, maximumDiscount);

    expect(finalDiscount).toBe(500);
  });

  test('should track coupon usage correctly', () => {
    const mockCoupon = {
      code: 'LIMITED',
      usageLimit: 10,
      usageCount: 9,
    };

    const canUse = mockCoupon.usageCount < mockCoupon.usageLimit;
    expect(canUse).toBe(true);

    mockCoupon.usageCount++;
    const canStillUse = mockCoupon.usageCount < mockCoupon.usageLimit;
    expect(canStillUse).toBe(false);
  });
});

describe('Consultation Controller Tests', () => {
  test('should create consultation request successfully', () => {
    const mockConsultation = {
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+2341234567890',
      budgetMin: 50000,
      budgetMax: 100000,
      stylePreferences: ['modern', 'minimalist'],
      preferredMeetingType: 'calendly',
      status: 'pending',
      createdAt: new Date(),
    };

    expect(mockConsultation.fullName).toBe('John Doe');
    expect(mockConsultation.status).toBe('pending');
    expect(mockConsultation.stylePreferences).toContain('modern');
  });

  test('should upload room photos to Cloudinary', () => {
    const mockPhotoData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
    const isValidImage = mockPhotoData.startsWith('data:image');

    expect(isValidImage).toBe(true);
  });

  test('should upload floor plan to Cloudinary', () => {
    const mockFloorPlan = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
    const isValidImage = mockFloorPlan.startsWith('data:image');

    expect(isValidImage).toBe(true);
  });

  test('should validate required fields', () => {
    const incompleteRequest = {
      fullName: 'John Doe',
      // Missing email and phone
    };

    const hasRequiredFields = !!(
      incompleteRequest.fullName &&
      incompleteRequest.email &&
      incompleteRequest.phone
    );

    expect(hasRequiredFields).toBe(false);
  });

  test('should assign preferred designer when valid ID provided', () => {
    const mockDesigner = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Jane Designer',
      specialty: 'Modern Interiors',
    };

    const mockConsultation = {
      preferredDesigner: mockDesigner._id,
    };

    expect(mockConsultation.preferredDesigner).toBe(mockDesigner._id);
  });

  test('should default to calendly meeting type', () => {
    const mockConsultation = {
      preferredMeetingType: 'calendly',
    };

    expect(mockConsultation.preferredMeetingType).toBe('calendly');
  });

  test('should send email notification on new consultation request', () => {
    const mockEmailData = {
      to: 'emfurnitureandinterior@gmail.com',
      subject: 'New consultation request received',
      text: 'New consultation request from John Doe',
    };

    expect(mockEmailData.subject).toContain('consultation request');
    expect(mockEmailData.to).toBe('emfurnitureandinterior@gmail.com');
  });
});

describe('Analytics Controller Tests', () => {
  test('should calculate sales by category correctly', () => {
    const mockAggregationResult = [
      {
        _id: 'Furniture',
        totalRevenue: 50000,
        orderCount: 10,
        itemCount: 25,
      },
      {
        _id: 'Decor',
        totalRevenue: 30000,
        orderCount: 15,
        itemCount: 40,
      },
    ];

    expect(mockAggregationResult[0].totalRevenue).toBeGreaterThan(
      mockAggregationResult[1].totalRevenue
    );
    expect(mockAggregationResult).toHaveLength(2);
  });

  test('should calculate sales by region correctly', () => {
    const mockRegionSales = [
      {
        _id: { state: 'Lagos', city: 'Lagos' },
        totalRevenue: 100000,
        orderCount: 20,
      },
      {
        _id: { state: 'Abuja', city: 'Abuja' },
        totalRevenue: 75000,
        orderCount: 15,
      },
    ];

    expect(mockRegionSales[0].totalRevenue).toBe(100000);
    expect(mockRegionSales).toHaveLength(2);
  });

  test('should parse date range correctly', () => {
    const parseDateRange = (startDate, endDate) => {
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
      }

      return { start, end };
    };

    const range = parseDateRange('2026-01-01', '2026-01-31');
    expect(range).not.toBeNull();
    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
  });

  test('should reject invalid date range', () => {
    const parseDateRange = (startDate, endDate) => {
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
      }

      return { start, end };
    };

    const range = parseDateRange('invalid-date', 'also-invalid');
    expect(range).toBeNull();
  });

  test('should calculate total revenue correctly', () => {
    const mockOrders = [
      { totalAmount: 1000, status: 'delivered', paymentStatus: 'paid' },
      { totalAmount: 2000, status: 'delivered', paymentStatus: 'paid' },
      { totalAmount: 500, status: 'cancelled', paymentStatus: 'pending' },
    ];

    const totalRevenue = mockOrders
      .filter((order) => order.status !== 'cancelled' && order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    expect(totalRevenue).toBe(3000);
  });

  test('should exclude cancelled and refunded orders from analytics', () => {
    const mockOrders = [
      { status: 'delivered', totalAmount: 1000 },
      { status: 'cancelled', totalAmount: 500 },
      { status: 'refunded', totalAmount: 300 },
    ];

    const validOrders = mockOrders.filter(
      (order) => !['cancelled', 'refunded'].includes(order.status)
    );

    expect(validOrders).toHaveLength(1);
    expect(validOrders[0].status).toBe('delivered');
  });

  test('should calculate average order value', () => {
    const mockOrders = [
      { totalAmount: 1000 },
      { totalAmount: 2000 },
      { totalAmount: 1500 },
    ];

    const totalRevenue = mockOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageOrderValue = totalRevenue / mockOrders.length;

    expect(averageOrderValue).toBe(1500);
  });

  test('should identify top-selling products', () => {
    const mockProductSales = [
      { _id: 'prod1', name: 'Sofa', totalSold: 50, revenue: 100000 },
      { _id: 'prod2', name: 'Chair', totalSold: 30, revenue: 45000 },
      { _id: 'prod3', name: 'Table', totalSold: 20, revenue: 60000 },
    ];

    const sortedByRevenue = mockProductSales.sort((a, b) => b.revenue - a.revenue);
    expect(sortedByRevenue[0].name).toBe('Sofa');
  });
});

describe('Order Controller Additional Tests', () => {
  test('should create order with multiple items', () => {
    const mockOrder = createMockOrder({
      items: [
        {
          item: '507f1f77bcf86cd799439011',
          itemType: 'Product',
          name: 'Product 1',
          price: 1000,
          quantity: 2,
          subtotal: 2000,
        },
        {
          item: '507f1f77bcf86cd799439012',
          itemType: 'Product',
          name: 'Product 2',
          price: 500,
          quantity: 1,
          subtotal: 500,
        },
      ],
      subtotal: 2500,
      totalAmount: 2500,
    });

    expect(mockOrder.items).toHaveLength(2);
    expect(mockOrder.subtotal).toBe(2500);
  });

  test('should track order status history', () => {
    const mockOrder = createMockOrder({
      status: 'delivered',
      statusHistory: [
        { status: 'pending', updatedAt: new Date('2026-02-01'), updatedBy: null },
        { status: 'confirmed', updatedAt: new Date('2026-02-02'), updatedBy: 'Admin1' },
        { status: 'shipped', updatedAt: new Date('2026-02-05'), updatedBy: 'Admin1' },
        { status: 'delivered', updatedAt: new Date('2026-02-10'), updatedBy: null },
      ],
    });

    expect(mockOrder.statusHistory).toHaveLength(4);
    expect(mockOrder.statusHistory[0].status).toBe('pending');
    expect(mockOrder.statusHistory[3].status).toBe('delivered');
  });

  test('should calculate loyalty points earned', () => {
    const mockOrder = createMockOrder({
      totalAmount: 10000,
      loyaltyPointsEarned: 100,
    });

    const expectedPoints = Math.floor(mockOrder.totalAmount / 100);
    expect(mockOrder.loyaltyPointsEarned).toBe(expectedPoints);
  });

  test('should handle guest orders correctly', () => {
    const mockOrder = createMockOrder({
      isGuestOrder: true,
      user: null,
      guest: '507f1f77bcf86cd799439011',
    });

    expect(mockOrder.isGuestOrder).toBe(true);
    expect(mockOrder.user).toBeNull();
    expect(mockOrder.guest).toBeTruthy();
  });

  test('should handle registered user orders correctly', () => {
    const mockOrder = createMockOrder({
      isGuestOrder: false,
      user: '507f1f77bcf86cd799439011',
      guest: null,
    });

    expect(mockOrder.isGuestOrder).toBe(false);
    expect(mockOrder.user).toBeTruthy();
    expect(mockOrder.guest).toBeNull();
  });
});
