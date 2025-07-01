// models/User.js
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: { type: Number, required: true, min: 1, default: 1 },
});

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
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
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
