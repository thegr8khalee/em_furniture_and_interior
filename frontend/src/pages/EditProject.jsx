// src/pages/AdminEditProjectPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

// NOTE: Assuming this store provides getProjectById and updateProject
import { useProjectsStore } from '../store/useProjectsStore';
import { useAdminStore } from '../store/useAdminStore';

const AdminEditProjectPage = () => {
  const { projectId } = useParams();
  console.log(projectId)
  // Assuming useProjectsStore provides the necessary actions
  const { updateProject, isUpdatingProject } =
    useAdminStore();
    const { getProjectById, isGettingProject } = useProjectsStore();
  const navigate = useNavigate();

  const editorRef = useRef(null);

  const handleEditorInit = (evt, editor) => {
    editorRef.current = editor;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '', // Set from TinyMCE
    location: '',
    price: '',
    category: '',
    images: [], // Stores a mix of {url, public_id} and {url: base64, isNew: true}
  });

  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]); // Stores URLs for display

  useEffect(() => {
    const fetchProjectData = async () => {
      if (projectId) {
        // Assuming getProjectById handles the fetching and returns the project object
        const projectData = await getProjectById(projectId);

        console.log(projectData)

        if (projectData) {
          setFormData({
            title: projectData.title || '',
            description: projectData.description || '',
            location: projectData.location || '',
            price: projectData.price || '',
            category: projectData.category || '',
            images: projectData.images || [], // Initialize with existing images from DB
          });
          // Set image previews from existing image URLs
          setImagePreviews(projectData.images?.map((img) => img.url) || []);
        } else {
          // Navigate if project data couldn't be loaded (e.g., 404)
          navigate('/admin/dashboard?section=projects');
          toast.error('Project not found or failed to load.');
        }
      }
    };
    fetchProjectData();
  }, [projectId, getProjectById, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  // Handles selecting new files and merging them with existing Cloudinary images
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    e.target.value = null; // Clear the input

    setError(null);

    const existingCloudinaryImages = formData.images.filter(
      (img) => !img.isNew
    );
    const existingCloudinaryPreviews = imagePreviews.filter(
      (url) => !url.startsWith('data:image') // Cloudinary URLs won't be base64 strings
    );

    const newImagesToProcess = [];
    const newPreviewsToProcess = [];
    let filesProcessedCount = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImagesToProcess.push({ url: reader.result, isNew: true });
        newPreviewsToProcess.push(reader.result);
        filesProcessedCount++;

        if (filesProcessedCount === files.length) {
          setFormData((prevData) => ({
            ...prevData,
            // Combine existing images with newly selected Base64 images
            images: [...existingCloudinaryImages, ...newImagesToProcess],
          }));
          // Combine existing previews with new Base64 previews
          setImagePreviews([
            ...existingCloudinaryPreviews,
            ...newPreviewsToProcess,
          ]);
        }
      };
      reader.onerror = () => {
        setError('Failed to read image file.');
        toast.error('Failed to read image file.');
      };
      reader.readAsDataURL(file);
    });
  };

  // Handles removing an image by its index
  const handleRemoveImage = (indexToRemove) => {
    setFormData((prevData) => {
      const updatedImages = prevData.images.filter(
        (_, index) => index !== indexToRemove
      );
      return { ...prevData, images: updatedImages };
    });
    setImagePreviews((prevPreviews) =>
      prevPreviews.filter((_, index) => index !== indexToRemove)
    );
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const htmlDescription = editorRef.current
      ? editorRef.current.getContent()
      : '';

    // --- Client-side Validation ---

    // 1. Description validation
    const strippedDescription = htmlDescription.replace(/<[^>]*>/g, '').trim();
    if (!strippedDescription) {
      setError('Description cannot be empty.');
      return;
    }

    // 2. Images validation (must have at least one image)
    if (formData.images.length === 0) {
      setError('At least one image is required for the project.');
      return;
    }

    // 3. Price validation
    const parsedPrice = parseFloat(formData.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Price/Budget must be a valid number greater than 0.');
      return;
    }

    // Prepare data for submission
    const dataToSubmit = {
      ...formData,
      description: htmlDescription,
      price: parsedPrice, // Send parsed number
    };

    // Prepare images for submission:
    // Keep the structure for the backend to differentiate between existing and new
    dataToSubmit.images = formData.images.map((img) => {
      // For existing images (no isNew or isNew: false/undefined), just send the existing object
      // For new images, ensure isNew: true is explicitly set
      if (img.isNew) {
        return { url: img.url, isNew: true };
      }
      return img; // For existing images from DB, pass the full object
    });

    // --- Submission ---
    // Assuming updateProject takes (projectId, dataToUpdate)
    const success = await updateProject(projectId, dataToSubmit);

    if (success) {
      toast.success('Project updated successfully!');
      navigate('/admin/dashboard?section=projects'); // Go back to project list
    }
  };

  // Show loading spinner while fetching initial data
  if (isGettingProject) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading project data...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="px-4 py-12 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Edit Project
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
                initialValue={formData.description} // Set initial value from fetched project data
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

          {/* Price/Budget */}
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
              value={Number(formData.price).toFixed(2)}
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
              <span className="label-text">Project Images</span>
            </label>
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              className="file-input file-input-bordered w-full rounded-full"
              onChange={handleImageChange}
            />
            <p className="text-sm text-gray-500 mt-1">
              Select one or more images.
            </p>

            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imagePreviews.map((previewUrl, index) => (
                  <div
                    key={index}
                    className="relative group w-full h-24 sm:h-32 rounded-md overflow-hidden shadow-sm border border-gray-200"
                  >
                    <img
                      src={previewUrl}
                      alt={`Project Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      aria-label="Remove image"
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
              className="btn btn-primary w-full text-lg font-semibold py-3 rounded-full shadow-md hover:shadow-lg transition duration-200 text-white font-[poppins]"
              disabled={isUpdatingProject}
            >
              {isUpdatingProject ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update Project'
              )}
            </button>
          </div>

          {/* Cancel Button */}
          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-full"
              onClick={() => navigate('/admin/dashboard?section=projects')}
              disabled={isUpdatingProject}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminEditProjectPage;
