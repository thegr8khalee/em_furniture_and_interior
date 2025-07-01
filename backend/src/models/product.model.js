// models/Product.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true }, // e.g., 'Living Room', 'Bedroom', 'Dining Room'
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      required: false,
    }, // Link to Collection
    images: [{ type: String }], // Array of image URLs
    // stock: { type: Number, required: true, min: 0, default: 0 },
    reviews: [reviewSchema], // Embedded reviews
    averageRating: { type: Number, default: 0, min: 0, max: 5 }, // Calculated average rating
    isBestSeller: { type: Boolean, default: false }, // NEW: Indicates if product is a best seller
    isPromo: { type: Boolean, default: false }, // NEW: Indicates if product is on promotion
    discountedPrice: {
      type: Number,
      min: 0,
      required: function () {
        return this.isPromo;
      },
    }, // NEW: Discounted price, required if isPromo is true
  },
  { timestamps: true }
);

// Pre-save hook to calculate average rating
productSchema.pre('save', function (next) {
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

const Product = mongoose.model('Product', productSchema);

export default Product;
