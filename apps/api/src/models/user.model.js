// models/User.js
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  // Changed productId to item to support both Product and Collection in cart
  item: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: {
    type: String,
    required: true,
    enum: ['Product', 'Collection'],
  },
  quantity: { type: Number, required: true, min: 1, default: 1 },
});

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // Retained through R2 so the legacy cookie path keeps working while both
    // schemes run side by side, and so the import can be re-run idempotently.
    // Dropped once every session is a Supabase one.
    passwordHash: { type: String, required: true },
    // auth.users.id in Supabase. Sparse: users created before the import, and
    // any created while it is running, simply do not have one yet.
    supabaseUserId: { type: String, unique: true, sparse: true },
    phoneNumber: { type: String, required: false }, // Added phone number, not required
    cart: [cartItemSchema], // Embedded cart
    wishlist: [
      {
        // Embedded wishlist, now supports Products and Collections
        item: { type: mongoose.Schema.Types.ObjectId, required: true },
        itemType: {
          type: String,
          required: true,
          enum: ['Product', 'Collection'],
        },
      },
    ],
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

const User = mongoose.model('User', userSchema);

export default User;
