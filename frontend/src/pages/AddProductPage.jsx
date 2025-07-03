// src/pages/AdminAddProductPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import axiosInstance from '../../utils/axiosInstance'; // For API calls
// import { toast } from 'react-toastify'; // For notifications
import { Loader2, XCircle } from 'lucide-react'; // For loading spinner and remove icon
import { useCollectionStore } from '../store/useCollectionStore';
import { useAdminStore } from '../store/useAdminStore'; // Import useAdminStore

const AdminAddProductPage = () => {
  const { addProduct, isAddingProduct } = useAdminStore(); // Use isAddingProduct for loading state
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    collectionId: '',
    images: [], // Will now store Base64 strings
    isBestSeller: false,
    isPromo: false,
    discountedPrice: '',
    isForeign: false, // NEW: Added isForeign field
    origin: '', // NEW: Added origin field
  });
  // REMOVED: local 'loading' state, now using isAddingProduct from store
  const [error, setError] = useState(null); // Keep local error for client-side validation
  const [imagePreviews, setImagePreviews] = useState([]); // For displaying image previews

  const { collections, isGettingCollections, getCollections } =
    useCollectionStore();

  useEffect(() => {
    getCollections();
  }, [getCollections]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  // Handles image file selection and converts to Base64 (one by one)
  const handleImageChange = (e) => {
    const file = e.target.files[0]; // Get only the first file
    if (!file) return;

    // Reset the file input value to allow selecting the same file again after removal
    e.target.value = null;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prevData) => ({
        ...prevData,
        images: [...prevData.images, reader.result], // Add new Base64 string
      }));
      setImagePreviews((prevPreviews) => [...prevPreviews, reader.result]); // Add for preview
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
      // toast.error('Failed to read image file.'); // Use toast for user feedback
      // setLoading(false); // This was local loading, now handled by store's isAddingProduct
    };
    reader.readAsDataURL(file); // Read file as Base64 Data URL
  };

  // Handles removing an image by its index
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
    // setLoading(true); // Handled by isAddingProduct in store
    setError(null); // Clear local error before submission

    // Client-side validation for discountedPrice
    if (
      formData.isPromo &&
      (formData.discountedPrice === '' ||
        parseFloat(formData.discountedPrice) <= 0)
    ) {
      setError(
        'Discounted price is required and must be greater than 0 if product is on promotion.'
      );
      // setLoading(false); // Handled by isAddingProduct in store
      // toast.error('Discounted price is required and must be greater than 0 if product is on promotion.');
      return;
    }
    if (
      formData.isPromo &&
      parseFloat(formData.discountedPrice) >= parseFloat(formData.price)
    ) {
      setError('Discounted price must be less than the original price.');
      // setLoading(false); // Handled by isAddingProduct in store
      // toast.error('Discounted price must be less than the original price.');
      return;
    }
    // Client-side validation for isForeign and origin
    if (
      formData.isForeign &&
      (formData.origin === '' || formData.origin.trim() === '')
    ) {
      setError('Origin is required if product is marked as foreign.');
      return;
    }

    // Call the addProduct action from useAdminStore
    addProduct(formData); // addProduct should return true/false based on success

    navigate(-1); // Redirect on success

    // Error handling for addProduct is now managed within useAdminStore (e.g., via toast.error)
    // No need for local alert() or simulated delay.
  };

  return (
    // Wrapper div for centering and max-width
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="p-4 py-12 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Add New Product
        </h2>

        {error && ( // Display local client-side validation errors
          <div role="alert" className="alert alert-error mb-4 rounded-md">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Product Name</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g., Modern Sofa"
              className="input input-bordered w-full rounded-md"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              name="description"
              placeholder="A comfortable and stylish sofa..."
              className="textarea textarea-bordered h-24 w-full rounded-md"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Price ($)</span>
            </label>
            <input
              type="number"
              name="price"
              placeholder="999.99"
              step="0.01"
              className="input input-bordered w-full rounded-md"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Category</span>
            </label>
            <select
              name="category"
              className="select select-bordered w-full rounded-md"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category</option>
              <option value="Living Room">Living Room</option>
              <option value="Bedroom">Bedroom</option>
              <option value="Dining Room">Dining Room</option>
              {/* Add more categories as needed */}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Collection (Optional)</span>
            </label>
            <select
              name="collectionId"
              className="select select-bordered w-full rounded-md"
              value={formData.collectionId}
              onChange={handleChange}
            >
              <option value="">None</option>
              {isGettingCollections ? (
                <option disabled>Loading collections...</option>
              ) : collections && collections.length > 0 ? (
                collections.map((collection) => (
                  <option key={collection._id} value={collection._id}>
                    {collection.name}
                  </option>
                ))
              ) : (
                <option disabled>No collections available</option>
              )}
            </select>
          </div>

          {/* Images Field - Now handles Base64 conversion for single file input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Add Product Image</span>
            </label>
            <input
              type="file"
              name="images"
              accept="image/*"
              className="file-input file-input-bordered w-full rounded-md"
              onChange={handleImageChange}
            />
            <p className="text-sm text-gray-500 mt-1">
              Select an image file. You can add multiple images one by one.
            </p>

            {imagePreviews.length > 0 && ( // Display image previews with remove button
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {imagePreviews.map((src, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={src}
                      alt={`Product preview ${index + 1}`}
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

          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Is Best Seller?</span>
              <input
                type="checkbox"
                name="isBestSeller"
                className="checkbox checkbox-primary"
                checked={formData.isBestSeller}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Is on Promotion?</span>
              <input
                type="checkbox"
                name="isPromo"
                className="checkbox checkbox-primary"
                checked={formData.isPromo}
                onChange={handleChange}
              />
            </label>
          </div>

          {formData.isPromo && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Discounted Price ($)</span>
              </label>
              <input
                type="number"
                name="discountedPrice"
                placeholder="e.g., 799.99"
                step="0.01"
                className="input input-bordered w-full rounded-md"
                value={formData.discountedPrice}
                onChange={handleChange}
                required={formData.isPromo}
              />
            </div>
          )}

          {/* NEW: isForeign Checkbox */}
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Is Foreign Product?</span>
              <input
                type="checkbox"
                name="isForeign"
                className="checkbox checkbox-primary"
                checked={formData.isForeign}
                onChange={handleChange}
              />
            </label>
          </div>

          {/* NEW: Origin Input (conditionally rendered) */}
          {formData.isForeign && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Origin</span>
              </label>
              <input
                type="text"
                name="origin"
                placeholder="e.g., Italy, China"
                className="input input-bordered w-full rounded-md"
                value={formData.origin}
                onChange={handleChange}
                required={formData.isForeign}
              />
            </div>
          )}

          <div className="form-control mt-6">
            <button
              type="submit"
              className="btn btn-primary w-full text-lg font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black font-[poppins]"
              disabled={isAddingProduct}
            >
              {isAddingProduct ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Add Product'
              )}
            </button>
          </div>

          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-md"
              onClick={() => navigate('/admin/dashboard?section=products')}
              disabled={isAddingProduct}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminAddProductPage;
