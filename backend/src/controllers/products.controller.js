import mongoose from 'mongoose';
import Product from '../models/product.model.js';

export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 12; // Default to 12 items per page
    const skip = (page - 1) * limit;

    // --- Build Mongoose Query Object for Filtering ---
    let query = {};

    // 1. Search Query Filter (by name or description)
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search, 'i'); // Case-insensitive search
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // 2. Category Filter
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }

    // 3. Style Filter (NEWLY ADDED)
    // Check if a style query parameter is provided and add it to the query
    if (req.query.style) {
      // Use a case-insensitive regex for style matching to handle potential variations
      // or URL encoding (e.g., 'Antique/Royal' vs 'antique%2Froyal')
      const styleRegex = new RegExp(req.query.style.replace(/%2F/g, '/'), 'i');
      query.style = styleRegex;
    }

    // 4. Price Filter (minPrice, maxPrice)
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);

    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.price = {}; // Assuming 'price' is the field to filter by
      if (!isNaN(minPrice)) {
        query.price.$gte = minPrice;
      }
      if (!isNaN(maxPrice)) {
        query.price.$lte = maxPrice;
      }
    }

    // 5. Best Seller Filter
    if (req.query.isBestSeller === 'true') {
      query.isBestSeller = true;
    }

    // 6. Promo Filter
    if (req.query.isPromo === 'true') {
      query.isPromo = true;
    }

    // 7. Foreign Filter
    if (req.query.isForeign === 'true') {
      query.isForeign = true;
    }
    // --- End Filtering Logic ---

    // Get total count of products matching the applied filters
    const totalProducts = await Product.countDocuments(query);

    // Fetch products with filters and pagination
    const products = await Product.find(query)
      .populate('collectionId', 'name') // Optionally populate collection name
      .skip(skip)
      .limit(limit);

    // Determine if there are more pages/items available
    const hasMore = page * limit < totalProducts;

    res.status(200).json({
      products,
      currentPage: page,
      totalProducts,
      hasMore,
    });
  } catch (error) {
    console.error('Error in getProducts controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProductsCount = async (req, res) => {
  try {
    // Get the total count of all products (no filters applied)
    const totalProducts = await Product.countDocuments({});

    res.status(200).json({
      totalProducts, // Returns the total count of products
    });
  } catch (error) {
    console.error('Error in getProducts controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProductById = async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  try {
    const product = await Product.findById(productId)
      .populate('collectionId', 'name') // Optionally populate collection name
      .populate('reviews.userId', 'username'); // Populate username for reviews

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error('Error in getProductById controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
