// models/Collection.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  // Re-using reviewSchema for consistency
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const collectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, trim: true },
    // items: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // NEW: Price for the collection
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    reviews: [reviewSchema], // Embedded reviews for the collection
    averageRating: { type: Number, default: 0, min: 0, max: 5 }, // Calculated average rating for the collection
    isBestSeller: { type: Boolean, default: false }, // NEW: Indicates if collection is a best seller
    isPromo: { type: Boolean, default: false }, // NEW: Indicates if collection is on promotion
    coverImage: {
      // NEW: Cover image for the collection
      url: { type: String },
      public_id: { type: String },
    },
    discountedPrice: {
      type: Number,
      min: 0,
      required: function () {
        return this.isPromo;
      },
    }, // NEW: Discounted price, required if isPromo is true
    isForeign: { type: Boolean, default: false },
    origin: {
      type: String,
      trim: true,
      required: function () {
        return this.isForeign;
      },
    },
    style: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Pre-save hook to calculate average rating for the collection
collectionSchema.pre('save', function (next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce(
      (acc, review) => acc + review.rating,
      0
    );
    this.averageRating = (totalRating / this.reviews.length).toFixed(1);
  } else {
    this.averageRating = 0;
  }
  next();
});

const Collection = mongoose.model('Collection', collectionSchema);

export default Collection;
