// src/pages/AdminAddProjectPage.jsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { toast } from 'react-hot-toast';
import { Loader2, XCircle } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';

const AdminAddProjectPage = () => {
  // Assuming useProjectsStore provides the addProject action and loading state
  const { addProject, isAddingProject } = useAdminStore();
  const navigate = useNavigate();

  // Ref for TinyMCE editor instance
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '', // Set from TinyMCE content on submit
    location: '', // Project-specific field
    price: '',
    category: '',
    images: [], // Array of Base64 strings
  });

  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);

  // useEffect(() => { ... }, [...]); // No collection fetching needed for projects here

  // TinyMCE Initialization Handler
  const handleEditorInit = (evt, editor) => {
    editorRef.current = editor;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear the input value so the same file can be selected again after removal
    e.target.value = null;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prevData) => ({
        ...prevData,
        images: [...prevData.images, reader.result], // Add Base64 string to images array
      }));
      setImagePreviews((prevPreviews) => [...prevPreviews, reader.result]);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
      toast.error('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (indexToRemove) => {
    setFormData((prevData) => ({
      ...prevData,
      images: prevData.images.filter((_, index) => index !== indexToRemove),
    }));
    setImagePreviews((prevPreviews) =>
      prevPreviews.filter((_, index) => index !== indexToRemove)
    );
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Get content from TinyMCE editor
    const htmlDescription = editorRef.current
      ? editorRef.current.getContent()
      : '';

    // --- Client-side Validation ---

    // 1. Description validation
    const strippedDescription = htmlDescription.replace(/<[^>]*>/g, '').trim();
    if (!strippedDescription) {
      setError('Project description cannot be empty.');
      return;
    }

    // 2. Images validation
    if (formData.images.length === 0) {
      setError('At least one image is required for the project.');
      return;
    }

    // 3. Price validation
    const parsedPrice = parseFloat(formData.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Price must be a valid number greater than 0.');
      return;
    }

    // 4. Other required fields (handled by input 'required' but good to have a final check)
    if (
      !formData.title.trim() ||
      !formData.location.trim() ||
      !formData.category.trim()
    ) {
      setError(
        'Please fill out all required fields (Title, Location, Category).'
      );
      return;
    }

    // Prepare formData for submission
    const projectData = {
      ...formData,
      description: htmlDescription, // Set the HTML string
      price: parsedPrice, // Send parsed number
    };

    const success = await addProject(projectData);

    if (success) {
      // Navigate to the dashboard projects section on success
      navigate('/admin/dashboard?section=projects');
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="p-4 py-12 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Add New Project
        </h2>

        {error && (
          <div role="alert" className="alert alert-error mb-4 rounded-md">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Title */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Project Title</span>
            </label>
            <input
              type="text"
              name="title"
              placeholder="e.g., Luxury Penthouse Design"
              className="input input-bordered w-full rounded-full"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          {/* Description (TinyMCE) */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <div className="border border-base-300 rounded-md overflow-hidden">
              <Editor
                onInit={handleEditorInit}
                apiKey="esh5bav8bmcm4mdbribpsniybxdqty6jszu5ctwihsw35a5y" // <--- IMPORTANT: Replace with your TinyMCE API key
                init={{
                  height: 300,
                  menubar: false,
                  plugins: [
                    'advlist autolink lists link image charmap print preview anchor',
                    'searchreplace visualblocks code fullscreen',
                    'insertdatetime media table paste code help wordcount',
                  ],
                  toolbar:
                    'undo redo | formatselect | ' +
                    'bold italic backcolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | help',
                  content_style:
                    'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                }}
              />
            </div>
          </div>

          {/* Location */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Location</span>
            </label>
            <input
              type="text"
              name="location"
              placeholder="e.g., Ikoyi, Lagos"
              className="input input-bordered w-full rounded-full"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>

          {/* Price */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Price / Budget (₦)</span>
            </label>
            <input
              type="number"
              name="price"
              placeholder="15000000.00"
              step="0.01"
              className="input input-bordered w-full rounded-full"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>

          {/* Category */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Category</span>
            </label>
            <select
              name="category"
              className="select select-bordered w-full rounded-full"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Hospitality">Hospitality</option>
              <option value="Renovation">Renovation</option>
            </select>
          </div>

          {/* Images Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Add Project Image(s)</span>
            </label>
            <input
              type="file"
              name="images"
              accept="image/*"
              className="file-input file-input-bordered w-full rounded-full"
              onChange={handleImageChange}
            />
            <p className="text-sm text-gray-500 mt-1">
              Select an image file. Add multiple images one by one.
            </p>

            {imagePreviews.length > 0 && ( // Display image previews with remove button
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {imagePreviews.map((src, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={src}
                      alt={`Project preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md shadow-sm border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-control mt-6">
            <button
              type="submit"
              className="btn btn-primary w-full text-lg text-white font-semibold py-3 rounded-full shadow-md hover:shadow-lg transition duration-200  font-[poppins]"
              disabled={isAddingProject}
            >
              {isAddingProject ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Add Project'
              )}
            </button>
          </div>

          {/* Cancel Button */}
          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-full"
              onClick={() => navigate('/admin/dashboard?section=projects')}
              disabled={isAddingProject}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminAddProjectPage;
