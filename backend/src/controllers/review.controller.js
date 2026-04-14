
import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Collection from '../models/collection.model.js';
import Order from '../models/order.model.js';

const hasPurchasedItem = async ({ userId, itemId, itemType }) => {
  const eligibleStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];

  return Order.exists({
    user: userId,
    status: { $in: eligibleStatuses },
    items: {
      $elemMatch: {
        item: itemId,
        itemType,
      },
    },
  });
};

export const addReviewToProduct = async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id; // User ID from authenticated session

  // Basic validation
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }
  if (rating === undefined || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ message: 'Rating is required and must be between 1 and 5.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const hasPurchased = await hasPurchasedItem({
      userId,
      itemId: productId,
      itemType: 'Product',
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: 'Only verified purchasers can review this product.',
      });
    }

    // Check if the user has already reviewed this product
    const alreadyReviewed = product.reviews.some(
      (review) => review.userId.toString() === userId.toString()
    );

    if (alreadyReviewed) {
      return res
        .status(400)
        .json({ message: 'Product already reviewed by this user.' });
    }

    const newReview = {
      userId,
      rating,
      comment: comment || '', // Comment is optional
      isVerifiedPurchase: true,
      isApproved: false,
    };

    product.reviews.push(newReview);

    // Mongoose pre-save hook will automatically update averageRating
    await product.save();

    // Populate the user for the newly added review before sending response
    const populatedProduct = await Product.findById(productId).populate(
      'reviews.userId',
      'username'
    );

    // Find the newly added review to return it
    const addedReview = populatedProduct.reviews.find(
      (review) => review.userId._id.toString() === userId.toString()
    );

    res.status(201).json({
      message: 'Review submitted and pending approval.',
      review: addedReview,
      averageRating: populatedProduct.averageRating,
    });
  } catch (error) {
    console.error('Error in addReviewToProduct controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addReviewToCollection = async (req, res) => {
  const { collectionId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id; // User ID from authenticated session

  // Basic validation
  if (!mongoose.Types.ObjectId.isValid(collectionId)) {
    return res.status(400).json({ message: 'Invalid Collection ID format.' });
  }
  if (rating === undefined || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ message: 'Rating is required and must be between 1 and 5.' });
  }

  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    const hasPurchased = await hasPurchasedItem({
      userId,
      itemId: collectionId,
      itemType: 'Collection',
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: 'Only verified purchasers can review this collection.',
      });
    }

    // Check if the user has already reviewed this collection
    const alreadyReviewed = collection.reviews.some(
      (review) => review.userId.toString() === userId.toString()
    );

    if (alreadyReviewed) {
      return res
        .status(400)
        .json({ message: 'Collection already reviewed by this user.' });
    }

    const newReview = {
      userId,
      rating,
      comment: comment || '', // Comment is optional
      isVerifiedPurchase: true,
      isApproved: false,
    };

    collection.reviews.push(newReview);

    // Mongoose pre-save hook will automatically update averageRating
    await collection.save();

    // Populate the user for the newly added review before sending response
    const populatedCollection = await Collection.findById(
      collectionId
    ).populate('reviews.userId', 'username');

    // Find the newly added review to return it
    const addedReview = populatedCollection.reviews.find(
      (review) => review.userId._id.toString() === userId.toString()
    );

    res.status(201).json({
      message: 'Review submitted and pending approval.',
      review: addedReview,
      averageRating: populatedCollection.averageRating,
    });
  } catch (error) {
    console.error('Error in addReviewToCollection controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getPendingProductReviews = async (req, res) => {
  try {
    const products = await Product.find({ 'reviews.isApproved': false })
      .select('name reviews');

    const pending = [];

    products.forEach((product) => {
      product.reviews.forEach((review) => {
        if (!review.isApproved) {
          pending.push({
            type: 'Product',
            parentId: product._id,
            parentName: product.name,
            review,
          });
        }
      });
    });

    res.status(200).json({ pending });
  } catch (error) {
    console.error('Error in getPendingProductReviews: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getPendingCollectionReviews = async (req, res) => {
  try {
    const collections = await Collection.find({ 'reviews.isApproved': false })
      .select('name reviews');

    const pending = [];

    collections.forEach((collection) => {
      collection.reviews.forEach((review) => {
        if (!review.isApproved) {
          pending.push({
            type: 'Collection',
            parentId: collection._id,
            parentName: collection.name,
            review,
          });
        }
      });
    });

    res.status(200).json({ pending });
  } catch (error) {
    console.error('Error in getPendingCollectionReviews: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const approveProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.isApproved = true;
    await product.save();

    res.status(200).json({ message: 'Review approved.' });
  } catch (error) {
    console.error('Error in approveProductReview: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const rejectProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.remove();
    await product.save();

    res.status(200).json({ message: 'Review rejected and removed.' });
  } catch (error) {
    console.error('Error in rejectProductReview: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const approveCollectionReview = async (req, res) => {
  try {
    const { collectionId, reviewId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    const review = collection.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.isApproved = true;
    await collection.save();

    res.status(200).json({ message: 'Review approved.' });
  } catch (error) {
    console.error('Error in approveCollectionReview: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const rejectCollectionReview = async (req, res) => {
  try {
    const { collectionId, reviewId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found.' });
    }

    const review = collection.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.remove();
    await collection.save();

    res.status(200).json({ message: 'Review rejected and removed.' });
  } catch (error) {
    console.error('Error in rejectCollectionReview: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
