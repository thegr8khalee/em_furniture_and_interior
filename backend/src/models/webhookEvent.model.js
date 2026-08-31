import mongoose from 'mongoose';

/**
 * Record of every webhook a gateway has delivered.
 *
 * Gateways retry until they receive a 2xx, and they can deliver the same event
 * more than once even after success. The unique (gateway, eventId) index is the
 * idempotency guard: the insert is attempted before any state change, and a
 * duplicate-key error means "already handled, acknowledge and stop".
 */
const webhookEventSchema = new mongoose.Schema(
  {
    gateway: {
      type: String,
      required: true,
      enum: ['paystack', 'flutterwave', 'stripe'],
    },
    eventId: { type: String, required: true },
    eventType: { type: String },
    reference: { type: String },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    outcome: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

webhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ reference: 1 });
webhookEventSchema.index({ createdAt: -1 });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

export default WebhookEvent;
