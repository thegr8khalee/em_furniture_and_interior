// src/pages/AdminAddProductPage.jsx
import React, { useState, useEffect, useRef } from 'react'; // Import useRef for TinyMCE
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react'; // Import TinyMCE Editor component

import { toast } from 'react-hot-toast';
import { Loader2, XCircle } from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore';
import { useAdminStore } from '../store/useAdminStore';

const AdminAddProductPage = () => {
  const { addProduct, isAddingProduct } = useAdminStore();
  const navigate = useNavigate();

  // Ref for TinyMCE editor instance (useful for getting content directly)
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '', // This will be set from TinyMCE's content on submit
    items: '',
    price: '',
    category: '',
    style: '',
    collectionId: '',
    images: [],
    isBestSeller: false,
    isPromo: false,
    discountedPrice: '',
    isForeign: false,
    origin: '',
  });

  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);

  const { collections, isGettingCollections, getCollections } =
    useCollectionStore();

  useEffect(() => {
    getCollections();
  }, [getCollections]);

  // TinyMCE doesn't use a direct value prop for controlled component like input.
  // We'll get its content on form submission.
  // The onInit prop is useful if you need to access the editor instance.
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

    e.target.value = null;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prevData) => ({
        ...prevData,
        images: [...prevData.images, reader.result],
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
    const htmlDescription = editorRef.current ? editorRef.current.getContent() : '';

    // Client-side validation for description
    const strippedDescription = htmlDescription.replace(/<[^>]*>/g, '').trim();
    if (!strippedDescription) {
        setError('Description cannot be empty.');
        return;
    }

    // Client-side validation for discountedPrice
    if (
      formData.isPromo &&
      (formData.discountedPrice === '' ||
        parseFloat(formData.discountedPrice) <= 0)
    ) {
      setError(
        'Discounted price is required and must be greater than 0 if product is on promotion.'
      );
      return;
    }
    if (
      formData.isPromo &&
      parseFloat(formData.discountedPrice) >= parseFloat(formData.price)
    ) {
      setError('Discounted price must be less than the original price.');
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

    // Prepare formData for submission, including the HTML description
    const productData = {
      ...formData,
      description: htmlDescription, // Set the HTML string here
    };

    const success = await addProduct(productData);

    if (success) {
      navigate('/admin/dashboard?section=products');
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="p-4 py-12 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Add New Product
        </h2>

        {error && (
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

          {/* The Advanced Text Area (TinyMCE React) */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <div className="border border-base-300 rounded-md overflow-hidden"> {/* Container for TinyMCE */}
              <Editor
                onInit={handleEditorInit}
                apiKey="esh5bav8bmcm4mdbribpsniybxdqty6jszu5ctwihsw35a5y" // <--- IMPORTANT: Replace with your TinyMCE API key
                init={{
                  height: 300,
                  menubar: false,
                  plugins: [
                    'advlist autolink lists link image charmap print preview anchor',
                    'searchreplace visualblocks code fullscreen',
                    'insertdatetime media table paste code help wordcount'
                  ],
                  toolbar: 'undo redo | formatselect | ' +
                           'bold italic backcolor | alignleft aligncenter ' +
                           'alignright alignjustify | bullist numlist outdent indent | ' +
                           'removeformat | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                }}
                // initialValue={formData.description} // Use this if you're editing an existing product
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Items</span>
            </label>
            <textarea
              name="items"
              placeholder="(3+3+1+1) or Bed+Wardrobe+mirror..."
              className="textarea textarea-bordered h-24 w-full rounded-md"
              value={formData.items}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Price (₦)</span>
            </label>
            <input
              type="number"
              name="price"
              placeholder="999.99"
              step="0.01"
              className="input input-bordered w-full rounded-md"
              value={Number(formData.price).toFixed(2)}
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
              <option value="Armchair">Armchair</option>
              <option value="Bedroom">Bedroom</option>
              <option value="Dining Room">Dining Room</option>
              <option value="Center Table">Center Table</option>
              <option value="Wardrobe">Wardrobe</option>
              <option value="TV Unit">TV Unit</option>
              <option value="Carpet">Carpet</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Style</span>
            </label>
            <select
              name="style"
              className="select select-bordered w-full rounded-md"
              value={formData.style}
              onChange={handleChange}
              required
            >
              <option value="">Select a style</option>
              <option value="Modern">Modern</option>
              <option value="Contemporay">Contemporay</option>
              <option value="Antique/Royal">Antique/Royal</option>
              <option value="Bespoke">Bespoke</option>
              <option value="Minimalist">Minimalist</option>
              <option value="Glam">Glam</option>
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
                <span className="label-text">Discounted Price (₦)</span>
              </label>
              <input
                type="number"
                name="discountedPrice"
                placeholder="e.g., 799.99"
                step="0.01"
                className="input input-bordered w-full rounded-md"
                value={Number(formData.discountedPrice).toFixed(2)}
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
