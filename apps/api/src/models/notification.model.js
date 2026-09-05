import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true }, // a customers.id UUID
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['order', 'promo', 'system', 'loyalty'],
      default: 'system'
    },
    relatedOrder: { type: String }, // an orders.id UUID — orders are in PostgreSQL
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
