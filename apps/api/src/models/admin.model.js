// models/Admin.js
import mongoose from 'mongoose';
const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    // Staff identities move into the same Supabase user pool as customers,
    // which is what removes the shared-cookie collision in finding F-10.
    supabaseUserId: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      required: true,
      enum: [
        'super_admin',
        'admin',
        'editor',
        'support',
        'social_media_manager',
      ],
      default: 'admin',
    },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);
const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
