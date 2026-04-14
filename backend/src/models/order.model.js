import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'items.itemType'
  },
  itemType: {
    type: String,
    required: true,
    enum: ['Product', 'Collection']
  },
  name: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true,
    default: 'Nigeria'
  },
  postalCode: {
    type: String
  }
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // null for guest orders
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      default: null
    },
    isGuestOrder: {
      type: Boolean,
      default: false
    },
    items: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true
    },
    billingAddress: {
      type: shippingAddressSchema,
      required: false // Can be same as shipping
    },
    useSameAddressForBilling: {
      type: Boolean,
      default: true
    },
    // Pricing breakdown
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    couponCode: {
      type: String,
      default: null
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    loyaltyPointsEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    loyaltyPointsCredited: {
      type: Boolean,
      default: false
    },
    // Order status
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
      ],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash_on_delivery', 'bank_transfer', 'card', 'whatsapp', 'paystack', 'flutterwave', 'stripe', 'download_invoice'],
      default: 'whatsapp'
    },
    // Tracking
    trackingNumber: {
      type: String,
      default: null
    },
    trackingUrl: {
      type: String,
      default: null
    },
    carrier: {
      type: String,
      default: null
    },
    estimatedDeliveryDate: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    // Additional info
    notes: {
      type: String,
      default: ''
    },
    adminNotes: {
      type: String,
      default: ''
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Admin'
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        note: {
          type: String
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Generate unique order number before validation so 'required' passes
orderSchema.pre('validate', function (next) {
  if (this.isNew && !this.orderNumber) {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

// Add status to history when status changes
orderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
  next();
});

// Index for efficient queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ guest: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
