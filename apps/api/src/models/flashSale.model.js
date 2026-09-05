import mongoose from 'mongoose';

const flashSaleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    // sellable_items ids — the catalog is in PostgreSQL, so these cannot be
    // ObjectIds and cannot be populated. They move with this collection.
    productIds: [{ type: String }],
    collectionIds: [{ type: String }],
    bannerImageUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { timestamps: true }
);

flashSaleSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
flashSaleSchema.index({ startDate: 1, endDate: 1 });

const FlashSale = mongoose.model('FlashSale', flashSaleSchema);

export default FlashSale;
