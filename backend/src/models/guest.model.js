import mongoose from 'mongoose';

const guestCartItemSchema = new mongoose.Schema({
  // Updated to support both Product and Collection in guest cart
  item: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, required: true, enum: ['Product', 'Collection'] },
  quantity: { type: Number, required: true, min: 1, default: 1 },
});

const guestSessionSchema = new mongoose.Schema(
  {
    anonymousId: { type: String, required: true, unique: true }, // UUID from client-side cookie
    cart: [guestCartItemSchema],
    wishlist: [
      {
        // Wishlist for guest sessions, now supports Products and Collections
        item: { type: mongoose.Schema.Types.ObjectId, required: true },
        itemType: {
          type: String,
          required: true,
          enum: ['Product', 'Collection'],
        },
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }, // e.g., 7 days expiration
  },
  { timestamps: true }
);

// Create an index on expiresAt for automatic TTL (Time-To-Live) deletion by MongoDB
guestSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GuestSession = mongoose.model('GuestSession', guestSessionSchema);

export default GuestSession;
