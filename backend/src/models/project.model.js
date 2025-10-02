// models/Project.js
import mongoose from 'mongoose';
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ 
      url: { type: String, required: true }, 
      public_id: { type: String, required: true } 
    }],
    category: { type: String, required: true },
    location: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);
const Project = mongoose.model('Project', projectSchema);

export default Project;
