/**
 * Money handling for integer minor units (kobo).
 *
 * The database stores money as `money_minor`, a bigint domain. That makes the
 * *stored* value exact, but it cannot make an *incoming* value exact: Postgres
 * casts a fractional input to bigint by rounding it, silently. `100.33` becomes
 * `100` and `100.5` becomes `101`, with no error, before any CHECK constraint
 * gets to see it.
 *
 * So rounding has to be a deliberate act in application code. Everything that
 * produces an amount — a percentage discount, a tax rate, a currency
 * conversion — routes through here, where the rule is stated once and the
 * remainder is never quietly dropped.
 */

// A bigint column outruns JavaScript's exact integer range. ₦90 trillion in
// kobo is already at the edge, so anything past it is refused rather than
// silently losing precision on the way to the database.
const MAX_MINOR = Number.MAX_SAFE_INTEGER;

export class MoneyError extends Error {}

/** Throws unless the value is a whole number of minor units we can represent. */
export const assertMinor = (value, label = 'amount') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MoneyError(`${label} must be a finite number, got ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `${label} must be a whole number of minor units, got ${value}. ` +
        'Use toMinor() or a rounding helper rather than letting the database round it.'
    );
  }
  if (Math.abs(value) > MAX_MINOR) {
    throw new MoneyError(`${label} exceeds the exactly representable range: ${value}`);
  }
  return value;
};

/**
 * Major units (naira) to minor units (kobo).
 *
 * Rounds to the nearest kobo. 19.99 * 100 is 1998.9999999999998 in binary
 * floating point, so truncating here would lose a kobo on a very common price.
 */
export const toMinor = (major) => {
  if (typeof major !== 'number' || !Number.isFinite(major)) {
    throw new MoneyError(`Cannot convert ${String(major)} to minor units`);
  }
  const minor = Math.round(major * 100);
  return assertMinor(minor);
};

/**
 * Minor units back to major, for display only.
 *
 * Never feed the result back into a calculation: that is how a rounded value
 * re-enters the arithmetic and the error compounds.
 */
export const toMajor = (minor) => assertMinor(Number(minor)) / 100;

/** Formats an amount for a customer or a document. */
export const formatNaira = (minor) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(toMajor(minor));

/**
 * A percentage of an amount, rounded half up to the nearest minor unit.
 *
 * Half up rather than banker's rounding because it matches what an invoice
 * reader expects when they check the arithmetic by hand.
 */
export const percentOf = (minor, percent) => {
  assertMinor(minor, 'base amount');
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    throw new MoneyError(`percent must be a finite number, got ${String(percent)}`);
  }
  return assertMinor(Math.round((minor * percent) / 100));
};

/**
 * Splits an amount into n parts that sum back to exactly the original.
 *
 * Naive division leaves a remainder — ₦100.00 in three parts is 3333, 3333,
 * 3333, which is a kobo short. The remainder is distributed across the earliest
 * parts, so deposit schedules and instalment plans reconcile to the invoice.
 */
export const allocate = (minor, parts) => {
  assertMinor(minor, 'amount');
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError(`parts must be a positive integer, got ${String(parts)}`);
  }

  const base = Math.trunc(minor / parts);
  let remainder = minor - base * parts;
  const step = remainder >= 0 ? 1 : -1;

  return Array.from({ length: parts }, () => {
    if (remainder !== 0) {
      remainder -= step;
      return base + step;
    }
    return base;
  });
};

/**
 * Sums minor amounts, refusing anything that is not already exact.
 *
 * A single fractional value entering a total is how a ledger ends up not
 * balancing, so this validates rather than coercing.
 */
export const sumMinor = (amounts) =>
  amounts.reduce((total, amount, index) => {
    assertMinor(amount, `amount at index ${index}`);
    return assertMinor(total + amount, 'running total');
  }, 0);
