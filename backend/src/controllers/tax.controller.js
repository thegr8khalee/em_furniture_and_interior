import {
  resolveLineItems,
  computeShipping,
  computeTax,
  getTaxRate,
  resolveCoupon,
} from '../lib/orderPricing.js';

/**
 * Checkout tax quote.
 *
 * Prices are resolved from the catalog, not taken from the request, and the
 * rate comes from the same helpers order creation uses — so the figure shown at
 * checkout is the figure that will be charged. Previously this endpoint taxed
 * whatever `amount` the client sent, which made the quote decorative.
 */
export const calculateTax = async (req, res) => {
  try {
    const { items, couponCode, currency = 'NGN' } = req.body;

    const { lines, error } = await resolveLineItems(items);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const subtotal = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
    const { discount } = await resolveCoupon(couponCode, lines, subtotal);

    const shippingCost = computeShipping();
    const taxableAmount = round2(Math.max(0, subtotal - discount) + shippingCost);
    const amountToCollect = computeTax(taxableAmount);
    const rate = getTaxRate();

    const line_items = lines.map((line) => ({
      id: line.item,
      taxable_amount: line.subtotal,
      tax_collectable: round2(line.subtotal * rate),
      combined_tax_rate: rate,
    }));

    res.json({
      success: true,
      tax: {
        amountToCollect,
        rate,
        taxableAmount,
        jurisdiction: { country: 'NG', state: 'Lagos' },
        hasNexus: true,
        breakdown: {
          line_items,
          shipping: {
            tax_collectable: 0,
            taxable_amount: shippingCost,
            combined_tax_rate: rate,
          },
        },
      },
      // Echoed so the checkout page can show exactly what the server will charge.
      pricing: { subtotal, discount, shippingCost, taxAmount: amountToCollect },
      currency,
    });
  } catch (error) {
    console.error('Tax calculation error:', error);
    res.status(500).json({ message: 'Failed to calculate tax' });
  }
};
