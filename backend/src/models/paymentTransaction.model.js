import mongoose from 'mongoose';

const paymentTransactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: [
        'paystack',
        'flutterwave',
        'stripe',
        'bank_transfer',
        'cash_on_delivery',
        'whatsapp',
      ],
    },
    // Gateway-specific fields
    gateway: {
      type: String,
      enum: ['paystack', 'flutterwave', 'stripe', 'manual'],
    },
    gatewayReference: {
      type: String, // External payment reference from gateway
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed, // Complete gateway response
    },
    // Bank transfer specific
    bankTransferProof: {
      type: String, // Cloudinary URL for proof of payment
    },
    bankName: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    transferDate: {
      type: Date,
    },
    transferReference: {
      type: String,
    },
    // Payment status
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    // Verification
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    verifiedAt: {
      type: Date,
    },
    verificationNotes: {
      type: String,
    },
    // Refund
    refunded: {
      type: Boolean,
      default: false,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundedAt: {
      type: Date,
    },
    refundReason: {
      type: String,
    },
    refundReference: {
      type: String,
    },
    // Metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentTransactionSchema.index({ order: 1, status: 1 });
paymentTransactionSchema.index({ orderNumber: 1 });
paymentTransactionSchema.index({ gatewayReference: 1 });
paymentTransactionSchema.index({ status: 1, createdAt: -1 });
paymentTransactionSchema.index({ user: 1, createdAt: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);

export default PaymentTransaction;
