import mongoose from 'mongoose';
import Collection from '../models/collection.model.js';

export const getCollections = async (req, res) => {
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

    // 2. Price Filter (minPrice, maxPrice) - Assuming collections also have a 'price' field
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);

    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.price = {};
      if (!isNaN(minPrice)) {
        query.price.$gte = minPrice;
      }
      if (!isNaN(maxPrice)) {
        query.price.$lte = maxPrice;
      }
    }

    // 3. Best Seller Filter
    if (req.query.isBestSeller === 'true') {
      query.isBestSeller = true;
    }

    // 4. Promo Filter
    if (req.query.isPromo === 'true') {
      query.isPromo = true;
    }

    // 5. Foreign Filter
    if (req.query.isForeign === 'true') {
      query.isForeign = true;
    }
    // --- End Filtering Logic ---

    // Get total count of collections matching the applied filters
    const totalCollections = await Collection.countDocuments(query);

    // Fetch collections with filters and pagination
    const collections = await Collection.find(query).skip(skip).limit(limit);

    // Determine if there are more pages/items available
    const hasMore = page * limit < totalCollections;

    res.status(200).json({
      collections,
      currentPage: page,
      totalPages: Math.ceil(totalCollections / limit),
      totalCollections,
      hasMore,
    });
  } catch (error) {
    console.error('Error in getCollections controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCollectionsCount = async (req, res) => {
  try {
    // Get the total count of all collections (no filters or pagination)
    const totalCollections = await Collection.countDocuments({});

    res.status(200).json({
      totalCollections, // Returns only the total count
    });
  } catch (error) {
    console.error('Error in getCollections controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCollectionById = async (req, res) => {
  const { collectionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }

  try {
    const collection = await Collection.findById(collectionId)
      .populate('productIds', 'name description price images') // Populate product details
      .populate('reviews.userId', 'username'); // Populate username for reviews

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    // console.log(collection)

    res.status(200).json(collection);
  } catch (error) {
    console.error('Error in getCollectionById controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
