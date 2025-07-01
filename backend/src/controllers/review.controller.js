
import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Collection from '../models/collection.model.js';

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
      message: 'Review added successfully.',
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
      message: 'Review added successfully.',
      review: addedReview,
      averageRating: populatedCollection.averageRating,
    });
  } catch (error) {
    console.error('Error in addReviewToCollection controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
