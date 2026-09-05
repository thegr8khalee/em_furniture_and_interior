import { logger } from '../lib/logger.js';
import {
  ReviewError,
  addReview,
  approveReview,
  pendingReviews,
  rejectReview,
} from '../services/reviews.js';

/*
 * Reviews. One table for both kinds of item, so what used to be eight handlers
 * — the same four written twice, once for products and once for collections —
 * is four, with the kind as a parameter.
 */

const fail = (error, res, where) => {
  if (error instanceof ReviewError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where}`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

const submit = (itemType, param) => async (req, res) => {
  try {
    const { review, averageRating } = await addReview({
      itemId: req.params[param],
      itemType,
      customerId: req.user.id,
      rating: req.body?.rating,
      comment: req.body?.comment,
    });

    res.status(201).json({
      message: 'Review submitted and pending approval.',
      review,
      averageRating,
    });
  } catch (error) {
    fail(error, res, `add${itemType}Review`);
  }
};

const listPending = (itemType) => async (req, res) => {
  try {
    res.status(200).json({ pending: await pendingReviews(itemType) });
  } catch (error) {
    fail(error, res, `getPending${itemType}Reviews`);
  }
};

/**
 * Approving and rejecting take the review's own id.
 *
 * The route still carries the parent item in its path, because both frontends
 * build the URL that way, but it is no longer needed to find the review: a
 * review was a subdocument and is now a row.
 */
const approve = async (req, res) => {
  try {
    await approveReview(req.params.reviewId, req.admin.id);
    res.status(200).json({ message: 'Review approved.' });
  } catch (error) {
    fail(error, res, 'approveReview');
  }
};

const reject = async (req, res) => {
  try {
    if (!(await rejectReview(req.params.reviewId))) {
      return res.status(404).json({ message: 'Review not found.' });
    }
    res.status(200).json({ message: 'Review rejected and removed.' });
  } catch (error) {
    fail(error, res, 'rejectReview');
  }
};

export const addReviewToProduct = submit('Product', 'productId');
export const addReviewToCollection = submit('Collection', 'collectionId');
export const getPendingProductReviews = listPending('Product');
export const getPendingCollectionReviews = listPending('Collection');
export const approveProductReview = approve;
export const approveCollectionReview = approve;
export const rejectProductReview = reject;
export const rejectCollectionReview = reject;
