import mongoose from 'mongoose';

const promoBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    linkUrl: { type: String, trim: true },
    position: {
      type: String,
      enum: ['home', 'shop', 'collection', 'product'],
      default: 'home',
    },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

promoBannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
promoBannerSchema.index({ position: 1, priority: -1 });

const PromoBanner = mongoose.model('PromoBanner', promoBannerSchema);

export default PromoBanner;
