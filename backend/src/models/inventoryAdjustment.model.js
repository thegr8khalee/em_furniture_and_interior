import mongoose from 'mongoose';

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    delta: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: { type: String, trim: true },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

inventoryAdjustmentSchema.index({ product: 1, createdAt: -1 });

const InventoryAdjustment = mongoose.model(
  'InventoryAdjustment',
  inventoryAdjustmentSchema
);

export default InventoryAdjustment;
