import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
    },
    activityType: {
      type: String,
      required: true,
      enum: [
        'PRODUCT_VIEW',
        'COLLECTION_VIEW',
        'PROJECT_VIEW',
        'BLOG_VIEW',
        'ADD_TO_CART',
        'REMOVE_FROM_CART',
        'ADD_TO_WISHLIST',
        'REMOVE_FROM_WISHLIST',
        'SEARCH',
        'FILTER',
        'ORDER_PLACED',
        'REVIEW_SUBMITTED',
        'CONSULTATION_BOOKED',
        'ACCOUNT_CREATED',
        'LOGIN',
        'LOGOUT',
        'PASSWORD_RESET',
        'PROFILE_UPDATED',
      ],
    },
    resourceType: {
      type: String,
      enum: [
        'Product',
        'Collection',
        'Project',
        'BlogPost',
        'Order',
        'Review',
        'Consultation',
        'Cart',
        'Wishlist',
        'User',
        'Search',
      ],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      // Additional context (search query, filter params, etc.)
    },
    sessionId: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    referrer: {
      type: String,
    },
    page: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for analytics and querying
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ guest: 1, createdAt: -1 });
activityLogSchema.index({ activityType: 1, createdAt: -1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ sessionId: 1 });

// TTL index to automatically delete old activity logs after 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
