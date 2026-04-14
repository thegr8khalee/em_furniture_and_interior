# Frontend Testing Suite

## Overview
Comprehensive unit test suite for the E&M Furniture and Interior frontend application, built with React, Vite, and Vitest. Tests focus on business logic, data validation, and feature workflows without requiring external API connectivity.

## Test Statistics
- **Total Test Suites:** 1
- **Total Tests:** 43
- **Status:** ✅ All Passing
- **Execution Time:** ~2.2 seconds
- **Test Framework:** Vitest + React Testing Library

## Test Coverage

### 1. Payment Integration Tests (11 tests)
Testing payment gateway integrations and validation logic:

#### Paystack Integration (3 tests)
- ✅ Prepare Paystack checkout data (amount conversion to kobo)
- ✅ Validate Paystack payment reference
- ✅ Handle payment success redirect

#### Flutterwave Integration (2 tests)
- ✅ Prepare Flutterwave checkout data (tx_ref, currency, redirect URL)
- ✅ Validate Flutterwave transaction reference

#### Stripe Integration (2 tests)
- ✅ Prepare Stripe checkout data (orderId, amount, currency)
- ✅ Validate Stripe session ID format

#### Bank Transfer Proof Upload (3 tests)
- ✅ Validate image data format (base64 check)
- ✅ Reject non-image data
- ✅ Validate required fields for bank transfer

### 2. Tax Calculation Tests (4 tests)
Testing TaxJar integration logic:

- ✅ Calculate tax amount correctly (rate × subtotal)
- ✅ Validate shipping address for tax calculation
- ✅ Handle missing address gracefully
- ✅ Include shipping cost in taxable amount

### 3. Coupon Validation Tests (5 tests)
Testing coupon discount calculations and validation:

- ✅ Calculate percentage discount correctly
- ✅ Calculate fixed amount discount
- ✅ Cap discount at maximum value
- ✅ Validate minimum purchase requirement
- ✅ Validate coupon expiry date

### 4. Cart Operations Tests (5 tests)
Testing shopping cart functionality:

- ✅ Add item to cart
- ✅ Update item quantity
- ✅ Remove item from cart
- ✅ Calculate cart subtotal correctly
- ✅ Handle empty cart scenario

### 5. Order Management Tests (4 tests)
Testing order processing and tracking:

- ✅ Format order number correctly (ORD-XXXXXXXX-XXX)
- ✅ Calculate order total with discount and tax
- ✅ Track order status progression
- ✅ Validate order data for PDF generation

### 6. Consultation Request Tests (4 tests)
Testing interior design consultation workflows:

- ✅ Validate required consultation fields
- ✅ Handle optional budget range
- ✅ Handle multiple style preferences
- ✅ Validate image upload format

### 7. Wishlist Operations Tests (3 tests)
Testing product wishlist functionality:

- ✅ Add item to wishlist
- ✅ Remove item from wishlist
- ✅ Prevent duplicate items

### 8. Product Filtering Tests (4 tests)
Testing product search and filtering:

- ✅ Filter products by category
- ✅ Filter products by price range
- ✅ Search products by name (case-insensitive)
- ✅ Sort products by price (ascending)

### 9. User Authentication Tests (4 tests)
Testing user authentication and validation:

- ✅ Validate email format (regex check)
- ✅ Reject invalid email format
- ✅ Validate password strength (length, uppercase, lowercase, numbers)
- ✅ Handle guest session data

## Test Infrastructure

### Configuration Files

#### vitest.config.js
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

#### Setup File (src/__tests__/setup.js)
- Configures jsdom environment for DOM testing
- Mocks React Router hooks
- Mocks react-hot-toast notifications
- Mocks window.matchMedia for responsive design tests
- Mocks IntersectionObserver for scroll-based features
- Automatic cleanup after each test

### Test Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Testing Approach

### Unit Testing Strategy
These tests focus on **pure business logic** and **data transformations**:
- **No API mocking needed** - Tests validate data structures and calculations
- **Fast execution** - No network calls or external dependencies
- **Deterministic** - Same inputs always produce same outputs
- **Easy to maintain** - Simple, readable test cases

### What We Test
1. **Data Validation**: Email format, password strength, required fields
2. **Calculations**: Tax amounts, discounts, cart totals, order totals
3. **Data Transformations**: Currency conversion (NGN to kobo for Paystack)
4. **Business Rules**: Coupon expiry, minimum purchase, maximum discount
5. **State Management**: Cart operations, wishlist management
6. **Filtering Logic**: Product search, category filters, price ranges
7. **Format Validation**: Order numbers, payment references, image data

### What We Don't Test (Yet)
- React component rendering
- User interactions (clicks, form submissions)
- API integration (real HTTP requests)
- Routing navigation
- State management library integration (Zustand)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm test -- --run

# Run tests with UI
npm test:ui

# Run tests with coverage report
npm test:coverage

# Run specific test file
npm test src/__tests__/api.test.js

# Run tests in watch mode (default)
npm test
```

### Watch Mode Features
- Automatically reruns tests when files change
- Smart test selection (only runs related tests)
- Interactive CLI for filtering tests
- Quick feedback during development

## Test Categories

### Pure Logic Tests
These tests don't require mocking and focus on pure functions:
- Tax calculations
- Discount calculations
- Data validation (email, password)
- Format checking (order numbers, references)
- Array operations (cart, wishlist)

### Integration-Ready Tests
Tests that validate data structures ready for API integration:
- Payment gateway data preparation
- Order data for PDF generation
- Consultation form data validation
- Bank transfer proof upload validation

## Best Practices Implemented

### 1. **Fast & Reliable**
- No network calls = instant feedback
- No external dependencies = no flaky tests
- Pure logic = 100% deterministic

### 2. **Readable Test Names**
```javascript
it('should calculate percentage discount correctly')
it('should reject invalid email format')
it('should handle empty cart scenario')
```

### 3. **Focused Tests**
Each test validates one specific behavior:
- Single assertion per test (when possible)
- Clear arrange-act-assert pattern
- Descriptive variable names

### 4. **Realistic Test Data**
- Order numbers: `ORD-12345678-001`
- Payment references: `test_reference_123`, `FLW-TEST-123`
- Email: `john@example.com`
- Phone: `+2341234567890`

### 5. **Edge Cases Covered**
- Empty carts
- Expired coupons
- Invalid email formats
- Weak passwords
- Missing required fields
- Maximum discount caps

## Future Testing Enhancements

### Component Testing (React Testing Library)
```javascript
// Example: Testing CheckoutPage component
it('should render payment gateway options', () => {
  render(<CheckoutPage />);
  expect(screen.getByText('Paystack')).toBeInTheDocument();
  expect(screen.getByText('Flutterwave')).toBeInTheDocument();
  expect(screen.getByText('Stripe')).toBeInTheDocument();
});
```

### Integration Testing (MSW)
```javascript
// Example: Mocking API responses with MSW
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('/api/payments/paystack/initialize', (req, res, ctx) => {
    return res(ctx.json({ authorizationUrl: 'https://...' }));
  })
);
```

### E2E Testing (Playwright or Cypress)
```javascript
// Example: Full checkout flow
test('complete checkout with Paystack', async ({ page }) => {
  await page.goto('/cart');
  await page.click('text=Checkout');
  await page.click('text=Pay with Paystack');
  await expect(page).toHaveURL(/paystack\.com/);
});
```

## Continuous Integration

These tests integrate seamlessly into CI/CD pipelines:

### GitHub Actions Example
```yaml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- --run
```

### Test Coverage Goals
- **Current**: Logic testing (43 tests)
- **Target**: 80% code coverage
- **Future**: Component + Integration + E2E tests

## Performance Metrics

- **Test Execution**: ~18ms average
- **Setup Time**: ~366ms (jsdom initialization)
- **Transform Time**: ~79ms (Vite processing)
- **Total Duration**: ~2.2 seconds

## Testing Tools

### Core Tools
- **Vitest**: Fast unit test framework for Vite projects
- **React Testing Library**: DOM testing utilities
- **JSDOM**: Browser environment simulation

### Future Tools
- **MSW** (Mock Service Worker): API mocking
- **Playwright**: E2E testing
- **Storybook**: Component documentation & testing

## Key Features

✅ **Zero External Dependencies** - All tests run without API keys or network  
✅ **Fast Feedback Loop** - Sub-3-second execution time  
✅ **Cross-Platform** - Works on Windows, macOS, Linux  
✅ **Watch Mode** - Interactive development experience  
✅ **Coverage Reports** - Track untested code paths  
✅ **CI/CD Ready** - Easy integration into pipelines  

## Test Organization

```
frontend/
├── src/
│   ├── __tests__/
│   │   ├── setup.js          # Test environment configuration
│   │   └── api.test.js       # Business logic tests (43 tests)
│   ├── components/           # React components (future: *.test.jsx)
│   ├── pages/                # Page components (future: *.test.jsx)
│   └── lib/                  # Utility functions
├── vitest.config.js          # Vitest configuration
└── package.json              # Test scripts
```

## Notes

- Tests use **pure JavaScript logic** without mocking complex dependencies
- Focus on **data validation** and **calculation correctness**
- **Component tests** will be added in future iterations
- All 43 tests pass consistently without external services
- Tests serve as **living documentation** of business rules

## Contributing

When adding new features, add corresponding tests:

1. **Data Validation**: Test input validation and format checking
2. **Calculations**: Test mathematical operations with edge cases
3. **Business Rules**: Test conditions, limits, and constraints
4. **Error Handling**: Test graceful degradation

### Example Test Template

```javascript
describe('Feature Name Tests', () => {
  it('should handle happy path correctly', () => {
    // Arrange: Set up test data
    const input = { /* ... */ };
    
    // Act: Execute the logic
    const result = calculateSomething(input);
    
    // Assert: Verify the outcome
    expect(result).toBe(expectedValue);
  });

  it('should handle edge case gracefully', () => {
    // Test error scenarios
  });
});
```

## Summary

The frontend test suite provides **rapid feedback** on business logic correctness without the complexity of mocking external services. With **43 passing tests** covering payments, taxes, coupons, cart operations, orders, consultations, and authentication, the test suite ensures core functionality works as expected while maintaining fast execution times ideal for TDD workflows.
