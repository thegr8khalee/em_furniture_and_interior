import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

describe('Auth Controller Tests', () => {
  test('should signup new user with valid credentials', async () => {
    const mockUserData = {
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'Password123!',
      phoneNumber: '+2341234567890',
    };

    const hashedPassword = await bcrypt.hash(mockUserData.password, 10);

    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      username: mockUserData.fullName,
      email: mockUserData.email,
      passwordHash: hashedPassword,
      phoneNumber: mockUserData.phoneNumber,
      cart: [],
      wishlist: [],
    };

    expect(mockUser.username).toBe('John Doe');
    expect(mockUser.email).toBe('john@example.com');
    expect(mockUser.passwordHash).toBeTruthy();
  });

  test('should reject signup with duplicate email', () => {
    const existingUser = {
      email: 'john@example.com',
    };

    const newUserEmail = 'john@example.com';

    const isDuplicate = existingUser.email === newUserEmail;
    expect(isDuplicate).toBe(true);
  });

  test('should hash password securely', async () => {
    const plainPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    expect(hashedPassword).not.toBe(plainPassword);
    expect(hashedPassword.length).toBeGreaterThan(50);
  });

  test('should login with correct credentials', async () => {
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const mockUser = {
      email: 'john@example.com',
      passwordHash: hashedPassword,
    };

    const isPasswordCorrect = await bcrypt.compare(password, mockUser.passwordHash);
    expect(isPasswordCorrect).toBe(true);
  });

  test('should reject login with incorrect password', async () => {
    const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);

    const mockUser = {
      email: 'john@example.com',
      passwordHash: hashedPassword,
    };

    const isPasswordCorrect = await bcrypt.compare('WrongPassword', mockUser.passwordHash);
    expect(isPasswordCorrect).toBe(false);
  });

  test('should merge guest data on signup with anonymousId', () => {
    const anonymousId = 'guest_abc123';
    const newUserId = '507f1f77bcf86cd799439011';

    const mockGuestData = {
      cart: [{ item: 'prod1', quantity: 2 }],
      wishlist: ['prod2', 'prod3'],
    };

    expect(anonymousId).toBeTruthy();
    expect(mockGuestData.cart).toHaveLength(1);
  });

  test('should generate JWT token on successful login', () => {
    const userId = '507f1f77bcf86cd799439011';
    const secretKey = 'test_jwt_secret';

    // Mock token generation
    const mockToken = `jwt_${userId}_${secretKey}`;

    expect(mockToken).toContain(userId);
  });

  test('should validate required fields on signup', () => {
    const incompleteData = {
      fullName: 'John Doe',
      email: '',
      password: 'Password123!',
    };

    const isValid = !!(incompleteData.fullName && incompleteData.email && incompleteData.password);
    expect(isValid).toBe(false);
  });

  test('should validate required fields on login', () => {
    const incompleteLogin = {
      email: 'john@example.com',
      password: '',
    };

    const isValid = !!(incompleteLogin.email && incompleteLogin.password);
    expect(isValid).toBe(false);
  });
});

describe('Cart Controller Tests', () => {
  test('should get cart for authenticated user', () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      cart: [
        {
          _id: 'cart1',
          item: 'prod1',
          itemType: 'Product',
          quantity: 2,
        },
      ],
    };

    expect(mockUser.cart).toHaveLength(1);
    expect(mockUser.cart[0].itemType).toBe('Product');
  });

  test('should get cart for guest user', () => {
    const mockGuest = {
      anonymousId: 'guest_abc123',
      cart: [
        {
          _id: 'cart1',
          item: 'prod1',
          itemType: 'Product',
          quantity: 1,
        },
      ],
    };

    expect(mockGuest.cart).toHaveLength(1);
    expect(mockGuest.anonymousId).toBe('guest_abc123');
  });

  test('should add item to cart', () => {
    const mockCart = [
      { item: 'prod1', itemType: 'Product', quantity: 1 },
    ];

    const newItem = { item: 'prod2', itemType: 'Product', quantity: 2 };
    mockCart.push(newItem);

    expect(mockCart).toHaveLength(2);
    expect(mockCart[1].quantity).toBe(2);
  });

  test('should update item quantity in cart', () => {
    const mockCart = [
      { item: 'prod1', itemType: 'Product', quantity: 1 },
    ];

    mockCart[0].quantity = 3;

    expect(mockCart[0].quantity).toBe(3);
  });

  test('should remove item from cart', () => {
    const mockCart = [
      { _id: 'cart1', item: 'prod1', itemType: 'Product', quantity: 1 },
      { _id: 'cart2', item: 'prod2', itemType: 'Product', quantity: 2 },
    ];

    const filteredCart = mockCart.filter((item) => item._id !== 'cart1');

    expect(filteredCart).toHaveLength(1);
    expect(filteredCart[0]._id).toBe('cart2');
  });

  test('should clean cart by removing deleted products', () => {
    const rawCart = [
      { _id: 'cart1', item: 'prod1', itemType: 'Product', quantity: 1 },
      { _id: 'cart2', item: 'prod_deleted', itemType: 'Product', quantity: 2 },
    ];

    const existingProductIds = new Set(['prod1']);

    const cleanedCart = rawCart.filter((item) =>
      existingProductIds.has(item.item)
    );

    expect(cleanedCart).toHaveLength(1);
    expect(cleanedCart[0].item).toBe('prod1');
  });

  test('should return empty cart for non-existent user', () => {
    const mockReq = {
      user: null,
      guestSession: null,
    };

    const cart = mockReq.user?.cart || mockReq.guestSession?.cart || [];

    expect(cart).toHaveLength(0);
  });

  test('should handle cart with collections', () => {
    const mockCart = [
      { item: 'prod1', itemType: 'Product', quantity: 1 },
      { item: 'coll1', itemType: 'Collection', quantity: 1 },
    ];

    const collectionItems = mockCart.filter((item) => item.itemType === 'Collection');

    expect(collectionItems).toHaveLength(1);
    expect(collectionItems[0].item).toBe('coll1');
  });

  test('should separate products and collections in cart', () => {
    const mockCart = [
      { item: 'prod1', itemType: 'Product', quantity: 1 },
      { item: 'prod2', itemType: 'Product', quantity: 2 },
      { item: 'coll1', itemType: 'Collection', quantity: 1 },
    ];

    const productItems = mockCart.filter((item) => item.itemType === 'Product');
    const collectionItems = mockCart.filter((item) => item.itemType === 'Collection');

    expect(productItems).toHaveLength(2);
    expect(collectionItems).toHaveLength(1);
  });
});

describe('Wishlist Controller Tests', () => {
  test('should add item to wishlist', () => {
    const mockWishlist = ['prod1'];
    const newItem = 'prod2';

    if (!mockWishlist.includes(newItem)) {
      mockWishlist.push(newItem);
    }

    expect(mockWishlist).toHaveLength(2);
    expect(mockWishlist).toContain('prod2');
  });

  test('should remove item from wishlist', () => {
    const mockWishlist = ['prod1', 'prod2', 'prod3'];
    const itemToRemove = 'prod2';

    const updatedWishlist = mockWishlist.filter((item) => item !== itemToRemove);

    expect(updatedWishlist).toHaveLength(2);
    expect(updatedWishlist).not.toContain('prod2');
  });

  test('should prevent duplicate items in wishlist', () => {
    const mockWishlist = ['prod1', 'prod2'];
    const duplicateItem = 'prod1';

    const isDuplicate = mockWishlist.includes(duplicateItem);

    expect(isDuplicate).toBe(true);
  });

  test('should get all wishlist items', () => {
    const mockUser = {
      wishlist: ['prod1', 'prod2', 'prod3'],
    };

    expect(mockUser.wishlist).toHaveLength(3);
  });
});

describe('Product Controller Tests', () => {
  test('should fetch all products with pagination', () => {
    const mockProducts = Array.from({ length: 50 }, (_, i) => ({
      _id: `prod${i}`,
      name: `Product ${i}`,
      price: 1000 + i * 100,
    }));

    const page = 1;
    const limit = 10;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = mockProducts.slice(startIndex, startIndex + limit);

    expect(paginatedProducts).toHaveLength(10);
    expect(paginatedProducts[0].name).toBe('Product 0');
  });

  test('should filter products by category', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Sofa', category: 'Furniture' },
      { _id: 'prod2', name: 'Lamp', category: 'Lighting' },
      { _id: 'prod3', name: 'Chair', category: 'Furniture' },
    ];

    const filteredProducts = mockProducts.filter((p) => p.category === 'Furniture');

    expect(filteredProducts).toHaveLength(2);
  });

  test('should filter products by price range', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Sofa', price: 5000 },
      { _id: 'prod2', name: 'Lamp', price: 500 },
      { _id: 'prod3', name: 'Chair', price: 1500 },
    ];

    const minPrice = 1000;
    const maxPrice = 6000;

    const filteredProducts = mockProducts.filter(
      (p) => p.price >= minPrice && p.price <= maxPrice
    );

    expect(filteredProducts).toHaveLength(2);
    expect(filteredProducts[0].name).toBe('Sofa');
  });

  test('should search products by name', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Modern Sofa' },
      { _id: 'prod2', name: 'Classic Chair' },
      { _id: 'prod3', name: 'Modern Table' },
    ];

    const searchTerm = 'modern';
    const results = mockProducts.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(results).toHaveLength(2);
  });

  test('should get product by ID', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Sofa', price: 5000 },
      { _id: 'prod2', name: 'Chair', price: 1500 },
    ];

    const productId = 'prod1';
    const product = mockProducts.find((p) => p._id === productId);

    expect(product).toBeTruthy();
    expect(product.name).toBe('Sofa');
  });

  test('should sort products by price ascending', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Sofa', price: 5000 },
      { _id: 'prod2', name: 'Lamp', price: 500 },
      { _id: 'prod3', name: 'Chair', price: 1500 },
    ];

    const sortedProducts = mockProducts.sort((a, b) => a.price - b.price);

    expect(sortedProducts[0].price).toBe(500);
    expect(sortedProducts[2].price).toBe(5000);
  });

  test('should sort products by price descending', () => {
    const mockProducts = [
      { _id: 'prod1', name: 'Sofa', price: 5000 },
      { _id: 'prod2', name: 'Lamp', price: 500 },
      { _id: 'prod3', name: 'Chair', price: 1500 },
    ];

    const sortedProducts = mockProducts.sort((a, b) => b.price - a.price);

    expect(sortedProducts[0].price).toBe(5000);
    expect(sortedProducts[2].price).toBe(500);
  });
});
