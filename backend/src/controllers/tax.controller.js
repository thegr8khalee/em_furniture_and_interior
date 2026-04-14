export const calculateTax = async (req, res) => {
  try {
    const { items, amount, currency = 'NGN' } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Items are required for tax calculation' });
    }

    // Get tax rate percentage from environment (default to 7.5 if not set)
    // The value in .env should be just the number, e.g., "7.5"
    const taxRateConfig = process.env.TAX_RATE_PERCENTAGE;
    const taxPercentage = taxRateConfig ? parseFloat(taxRateConfig) : 7.5;
    
    // Tax rate as decimal (e.g., 0.075)
    // If taxPercentage is 7.5, rate is 0.075
    const rate = taxPercentage / 100;

    // Calculate total tax
    // Simple calculation: Amount * Rate
    // Ensure accurate rounding for currency
    const amountToCollect = Math.round((amount * rate) * 100) / 100;
    
    // Calculate breakdown per item
    // Note: items structure from frontend usually has price and quantity
    const line_items = items.map((item) => {
      const itemprice = item.price || 0;
      const itemquantity = item.quantity || 1;
      const itemTotal = itemprice * itemquantity;
      const itemTaxPromise = itemTotal * rate;
      const itemTax = Math.round(itemTaxPromise * 100) / 100;
      
      return {
        id: item._id || item.id,
        taxable_amount: itemTotal,
        tax_collectable: itemTax,
        combined_tax_rate: rate,
        state_tax_rate: rate,
        county_tax_rate: 0,
        city_tax_rate: 0,
        special_district_tax_rate: 0,
      };
    });

    res.json({
      success: true,
      tax: {
        amountToCollect: amountToCollect,
        rate: rate,
        taxableAmount: amount, // The amount that was taxed
        jurisdiction: {
            country: 'NG',
            state: 'Lagos' // Default or derive from shipping if needed
        }, 
        hasNexus: true,
        breakdown: {
          line_items,
          shipping: {
            tax_collectable: 0, 
            taxable_amount: 0,
            combined_tax_rate: rate
          }
        },
      },
      currency,
    });
  } catch (error) {
    console.error('Tax calculation error:', error);
    res.status(500).json({ message: 'Failed to calculate tax' });
  }
};
