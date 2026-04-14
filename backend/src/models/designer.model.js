import mongoose from 'mongoose';

const designerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    avatar: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Designer = mongoose.model('Designer', designerSchema);

export default Designer;
