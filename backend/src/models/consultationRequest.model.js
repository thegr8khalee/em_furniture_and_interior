import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  { _id: false }
);

const consultationRequestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    budgetMin: { type: Number, min: 0, default: 0 },
    budgetMax: { type: Number, min: 0, default: 0 },
    stylePreferences: { type: [String], default: [] },
    roomPhotos: { type: [mediaSchema], default: [] },
    floorPlan: { type: mediaSchema, default: null },
    preferredDesigner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designer',
      default: null,
    },
    assignedDesigner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designer',
      default: null,
    },
    preferredMeetingType: {
      type: String,
      enum: ['calendly', 'zoom', 'meet', 'phone', 'none'],
      default: 'calendly',
    },
    meetingLink: { type: String, default: '' },
    scheduledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['new', 'scheduled', 'completed', 'cancelled'],
      default: 'new',
    },
    notes: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

consultationRequestSchema.index({ createdAt: -1 });
consultationRequestSchema.index({ status: 1, createdAt: -1 });

const ConsultationRequest = mongoose.model(
  'ConsultationRequest',
  consultationRequestSchema
);

export default ConsultationRequest;
