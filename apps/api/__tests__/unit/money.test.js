import {
  assertMinor,
  toMinor,
  toMajor,
  percentOf,
  allocate,
  sumMinor,
  MoneyError,
} from '../../src/lib/money.js';

// The database rounds a fractional input to bigint silently — 100.33 becomes
// 100, 100.5 becomes 101, with no error and no constraint able to see it. These
// helpers are where that rounding is made deliberate instead.

describe('assertMinor', () => {
  test('accepts whole minor units', () => {
    expect(assertMinor(0)).toBe(0);
    expect(assertMinor(150000)).toBe(150000);
    expect(assertMinor(-4500)).toBe(-4500);
  });

  test('refuses a fractional amount rather than letting the database round it', () => {
    expect(() => assertMinor(100.33)).toThrow(MoneyError);
    expect(() => assertMinor(100.5)).toThrow(/whole number of minor units/);
  });

  test('refuses values outside the exactly representable range', () => {
    // A bigint column outruns JavaScript's exact integers; past this point a
    // number would arrive at the database already wrong.
    expect(() => assertMinor(Number.MAX_SAFE_INTEGER + 2)).toThrow(/representable range/);
  });

  test('refuses non-numbers and non-finite values', () => {
    expect(() => assertMinor('1000')).toThrow(MoneyError);
    expect(() => assertMinor(null)).toThrow(MoneyError);
    expect(() => assertMinor(NaN)).toThrow(MoneyError);
    expect(() => assertMinor(Infinity)).toThrow(MoneyError);
  });

  test('names the field, so the error says which amount was wrong', () => {
    expect(() => assertMinor(1.5, 'shipping cost')).toThrow(/shipping cost/);
  });
});

describe('toMinor', () => {
  test('converts naira to kobo', () => {
    expect(toMinor(1500)).toBe(150000);
    expect(toMinor(0)).toBe(0);
  });

  test('does not lose a kobo to binary floating point', () => {
    // 19.99 * 100 is 1998.9999999999998; truncating would charge a kobo less on
    // a very ordinary price.
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0.07)).toBe(7);
    expect(toMinor(1234.56)).toBe(123456);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  test('handles a whole-naira price with no fractional part', () => {
    expect(toMinor(450000)).toBe(45000000);
  });
});

describe('toMajor', () => {
  test('converts back for display', () => {
    expect(toMajor(150000)).toBe(1500);
    expect(toMajor(1999)).toBe(19.99);
  });

  test('refuses a fractional minor unit', () => {
    expect(() => toMajor(1999.5)).toThrow(MoneyError);
  });

  test('round-trips exactly', () => {
    for (const naira of [0, 0.01, 19.99, 1234.56, 450000]) {
      expect(toMajor(toMinor(naira))).toBe(naira);
    }
  });
});

describe('percentOf', () => {
  test('computes a straightforward percentage', () => {
    expect(percentOf(100000, 10)).toBe(10000);
    expect(percentOf(100000, 7.5)).toBe(7500);
  });

  test('rounds half up to a whole kobo', () => {
    // 5% of 1005 kobo is 50.25 -> 50; 5% of 1010 is 50.5 -> 51.
    expect(percentOf(1005, 5)).toBe(50);
    expect(percentOf(1010, 5)).toBe(51);
  });

  test('always returns a whole number of minor units', () => {
    for (const base of [1, 7, 33, 101, 999, 123457]) {
      expect(Number.isInteger(percentOf(base, 7.5))).toBe(true);
    }
  });

  test('refuses a fractional base amount', () => {
    expect(() => percentOf(100.5, 10)).toThrow(/base amount/);
  });

  test('refuses a non-numeric percentage', () => {
    expect(() => percentOf(1000, '10')).toThrow(MoneyError);
  });
});

describe('allocate', () => {
  test('splits evenly when it divides cleanly', () => {
    expect(allocate(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  test('distributes the remainder rather than losing it', () => {
    // ₦100.00 in three parts. Naive division gives 3333 x 3, which is a kobo
    // short of the invoice it is meant to reconcile against.
    const parts = allocate(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(sumMinor(parts)).toBe(10000);
  });

  test('every split sums back to the original', () => {
    for (const amount of [1, 7, 100, 10000, 123457]) {
      for (const n of [1, 2, 3, 5, 7, 12]) {
        expect(sumMinor(allocate(amount, n))).toBe(amount);
      }
    }
  });

  test('handles a negative amount, as a refund schedule would', () => {
    const parts = allocate(-10000, 3);
    expect(sumMinor(parts)).toBe(-10000);
  });

  test('refuses a nonsensical part count', () => {
    expect(() => allocate(1000, 0)).toThrow(MoneyError);
    expect(() => allocate(1000, 2.5)).toThrow(MoneyError);
  });
});

describe('sumMinor', () => {
  test('adds exact amounts', () => {
    expect(sumMinor([100, 200, 300])).toBe(600);
    expect(sumMinor([])).toBe(0);
  });

  test('refuses a fractional amount instead of coercing it', () => {
    // One fractional value entering a total is how a ledger stops balancing.
    expect(() => sumMinor([100, 200.5])).toThrow(/index 1/);
  });

  test('stays exact over many small amounts', () => {
    expect(sumMinor(Array(1000).fill(1))).toBe(1000);
  });
});
