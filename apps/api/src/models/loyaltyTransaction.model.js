import mongoose from 'mongoose';

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    user: { type: String, required: true }, // a customers.id UUID
    order: { type: String }, // an orders.id UUID — orders are in PostgreSQL
    type: { type: String, enum: ['earn', 'redeem', 'adjustment'], required: true },
    points: { type: Number, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ user: 1, createdAt: -1 });

const LoyaltyTransaction = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);

export default LoyaltyTransaction;
