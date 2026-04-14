import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'STATUS_CHANGE',
        'PERMISSION_CHANGE',
        'EXPORT',
        'BULK_ACTION',
      ],
    },
    resourceType: {
      type: String,
      required: true,
      enum: [
        'Product',
        'Collection',
        'Project',
        'Order',
        'Coupon',
        'Review',
        'Consultation',
        'Designer',
        'BlogPost',
        'FAQ',
        'PromoBanner',
        'FlashSale',
        'Inventory',
        'Admin',
        'User',
        'System',
      ],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resourceName: {
      type: String,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      // Store before/after values for updates
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      // Additional context (IP, user agent, etc.)
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
