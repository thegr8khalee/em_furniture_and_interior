// models/Product.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

// UPDATED: Define a schema for image objects with only 'url'
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
  },
  { _id: false }
); // _id: false means Mongoose won't add an _id to subdocuments

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    items: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    style: { type: String, required: true, trim: true }, // e.g., 'Living Room', 'Bedroom', 'Dining Room'
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      required: false,
    }, // Link to Collection
    images: [imageSchema], // Array of image objects { url }
    // stock: { type: Number, required: true, min: 0, default: 0 }, // Uncomment if you track stock
    reviews: [reviewSchema], // Embedded reviews
    averageRating: { type: Number, default: 0, min: 0, max: 5 }, // Calculated average rating
    isBestSeller: { type: Boolean, default: false },
    isPromo: { type: Boolean, default: false },
    discountedPrice: {
      type: Number,
      min: 0,
      required: function () {
        return this.isPromo;
      },
    },
    isForeign: { type: Boolean, default: false },
    origin: {
      type: String,
      trim: true,
      required: function () {
        return this.isForeign;
      },
    },
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
