import Product from '../models/product.model.js';
import InventoryAdjustment from '../models/inventoryAdjustment.model.js';

export const getInventoryProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, lowStock } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name sku stockQuantity lowStockThreshold warehouseLocation'),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory products:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adjustInventory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { delta, newQuantity, reason } = req.body;

    if (delta === undefined && newQuantity === undefined) {
      return res.status(400).json({ message: 'Provide delta or newQuantity.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const previousQuantity = product.stockQuantity || 0;
    let updatedQuantity = previousQuantity;

    if (newQuantity !== undefined) {
      const parsed = parseInt(newQuantity, 10);
      if (isNaN(parsed) || parsed < 0) {
        return res
          .status(400)
          .json({ message: 'New quantity must be a non-negative number.' });
      }
      updatedQuantity = parsed;
    } else {
      const parsedDelta = parseInt(delta, 10);
      if (isNaN(parsedDelta)) {
        return res.status(400).json({ message: 'Delta must be a number.' });
      }
      updatedQuantity = Math.max(0, previousQuantity + parsedDelta);
    }

    product.stockQuantity = updatedQuantity;
    await product.save();

    await InventoryAdjustment.create({
      product: product._id,
      delta: updatedQuantity - previousQuantity,
      previousQuantity,
      newQuantity: updatedQuantity,
      reason,
      adjustedBy: req.admin?._id,
    });

    res.json({
      success: true,
      message: 'Inventory updated successfully.',
      product: {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        warehouseLocation: product.warehouseLocation,
      },
    });
  } catch (error) {
    console.error('Error adjusting inventory:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
