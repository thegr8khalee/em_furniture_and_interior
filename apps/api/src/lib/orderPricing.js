import Product from '../models/product.model.js';
import Collection from '../models/collection.model.js';
import Coupon from '../models/coupon.model.js';

/**
 * Server-side order pricing — the single source of truth for what an order costs.
 *
 * Before this existed, `shippingCost` and `taxAmount` were read straight from the
 * request body and folded into `totalAmount` with no validation, so a modified
 * request set its own tax (finding F-05). Line prices were already re-fetched
 * server-side; everything else now is too.
 *
 * The tax endpoint and order creation both call in here, so the figure quoted at
 * checkout and the figure charged cannot disagree.
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const getTaxRate = () => {
  const configured = parseFloat(process.env.TAX_RATE_PERCENTAGE);
  const percentage = Number.isFinite(configured) ? configured : 7.5;
  return percentage / 100;
};

/**
 * Shipping is a flat rate the server owns. It has always been zero in practice —
 * the checkout page hard-codes free shipping — but the value now comes from
 * configuration rather than from the client, so introducing real shipping rules
 * later is a change in one place.
 */
export const computeShipping = () => {
  const configured = parseFloat(process.env.SHIPPING_FLAT_RATE);
  return round2(Number.isFinite(configured) ? configured : 0);
};

export const computeTax = (taxableAmount) => round2(Math.max(0, taxableAmount) * getTaxRate());

/**
 * Resolve requested items against the catalog and price them from stored data.
 * Returns { error } for anything that cannot be resolved, so a request naming a
 * deleted product fails loudly instead of being silently priced at zero.
 */
export const resolveLineItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Order must contain at least one item' };
  }

  const lines = [];

  for (const requested of items) {
    const quantity = Number(requested?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: `Invalid quantity for item ${requested?.item ?? requested?.id}` };
    }

    const id = requested.item ?? requested.id;
    const declaredType = requested.itemType;

    let doc = null;
    let itemType = declaredType;

    if (declaredType === 'Product') {
      doc = await Product.findById(id);
    } else if (declaredType === 'Collection') {
      doc = await Collection.findById(id);
    } else if (!declaredType) {
      // The tax endpoint sends ids without a type; try both.
      doc = await Product.findById(id);
      itemType = 'Product';
      if (!doc) {
        doc = await Collection.findById(id);
        itemType = 'Collection';
      }
    } else {
      return { error: 'Invalid item type' };
    }

    if (!doc) {
      return { error: `${declaredType || 'Item'} ${id} not found` };
    }

    // discountedPrice wins when set, matching the storefront.
    const price = round2(doc.discountedPrice || doc.price);
    const subtotal = round2(price * quantity);

    lines.push({
      item: doc._id,
      itemType,
      name: doc.name,
      imageUrl: doc.images?.[0],
      price,
      quantity,
      subtotal,
      category: doc.category,
    });
  }

  return { lines };
};

/**
 * Validate a coupon against the resolved lines. Does NOT increment usage —
 * that is the caller's job, and only once the order has actually been saved.
 */
export const resolveCoupon = async (couponCode, lines, subtotal) => {
  if (!couponCode) return { coupon: null, discount: 0 };

  const coupon = await Coupon.findOne({
    code: String(couponCode).toUpperCase(),
    isActive: true,
  });

  if (!coupon) return { coupon: null, discount: 0 };

  const validation = await coupon.isValidForCart(lines, subtotal);
  if (!validation.valid) return { coupon: null, discount: 0, reason: validation.message };

  return { coupon, discount: round2(coupon.calculateDiscount(subtotal)) };
};

/**
 * Full pricing for a set of requested items. Every figure is derived here;
 * nothing the client sends about money is trusted.
 */
export const priceOrder = async ({ items, couponCode }) => {
  const { lines, error } = await resolveLineItems(items);
  if (error) return { error };

  const subtotal = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const { coupon, discount } = await resolveCoupon(couponCode, lines, subtotal);

  const shippingCost = computeShipping();
  const discountedSubtotal = Math.max(0, round2(subtotal - discount));
  const taxAmount = computeTax(discountedSubtotal + shippingCost);
  const totalAmount = round2(discountedSubtotal + shippingCost + taxAmount);

  return {
    lines,
    coupon,
    pricing: { subtotal, discount, shippingCost, taxAmount, totalAmount },
  };
};
