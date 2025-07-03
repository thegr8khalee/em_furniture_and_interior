// src/pages/AdminEditProductPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // NEW: Import useParams
// import { toast } from 'react-toastify'; // For notifications
import { Loader2, XCircle } from 'lucide-react'; // For loading spinner and remove icon
import { useCollectionStore } from '../store/useCollectionStore';
import { useAdminStore } from '../store/useAdminStore'; // Import useAdminStore
import { useProductsStore } from '../store/useProductsStore';

const AdminEditProductPage = () => {
  const { productId } = useParams(); // Get product ID from URL
  const { updateProduct, isUpdatingProduct } = useAdminStore();
  const { getProductById, isGettingProducts } = useProductsStore();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    collectionId: '',
    images: [],
    isBestSeller: false,
    isPromo: false,
    discountedPrice: '',
    isForeign: false,
    origin: '',
  });
  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]); // For displaying image previews

  const { collections, isGettingCollections, getCollections } =
    useCollectionStore();

  // Effect to fetch collections for the dropdown
  useEffect(() => {
    getCollections();
  }, [getCollections]);

  // Effect to fetch product data when component mounts or productId changes
  useEffect(() => {
    const fetchProductData = async () => {
        console.log(productId)
      if (productId) {
        const productData = await getProductById(productId);
        if (productData) {
          setFormData({
            name: productData.name || '',
            description: productData.description || '',
            price: productData.price || '', // Keep as string for input
            category: productData.category || '',
            collectionId: productData.collectionId?._id || '', // Use _id if populated
            images: productData.images || [], // Backend sends {url, public_id} objects
            isBestSeller: productData.isBestSeller || false,
            isPromo: productData.isPromo || false,
            discountedPrice: productData.discountedPrice || '', // Keep as string for input
            isForeign: productData.isForeign || false,
            origin: productData.origin || '',
          });
          // Set image previews from existing image URLs
          setImagePreviews(productData.images.map((img) => img.url));
        } else {
          // Product not found or error fetching
          navigate('/admin/dashboard?section=products'); // Redirect back
          // toast.error('Product not found or failed to load.');
        }
      }
    };
    fetchProductData();
  }, [productId, getProductById, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prevData) => {
      const newData = {
        ...prevData,
        [name]: type === 'checkbox' ? checked : value,
      };

      if (name === 'isPromo' && !checked) {
        newData.discountedPrice = '';
      }
      if (name === 'isForeign' && !checked) {
        newData.origin = '';
      }
      return newData;
    });
    setError(null);
  };

  // Handles adding a new image (Base64)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = null; // Reset input for next selection

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prevData) => ({
        ...prevData,
        images: [...prevData.images, { url: reader.result, isNew: true }], // Mark new images
      }));
      setImagePreviews((prevPreviews) => [...prevPreviews, reader.result]);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
      // toast.error('Failed to read image file.');
    };
    reader.readAsDataURL(file);
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
    setError(null);

    const dataToSubmit = { ...formData };

    const parsedPrice = parseFloat(dataToSubmit.price);
    const parsedDiscountedPrice = parseFloat(dataToSubmit.discountedPrice);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    dataToSubmit.price = parsedPrice;

    if (dataToSubmit.isPromo) {
      if (isNaN(parsedDiscountedPrice) || parsedDiscountedPrice <= 0) {
        setError(
          'Discounted price is required and must be greater than 0 if product is on promotion.'
        );
        return;
      }
      if (parsedDiscountedPrice >= parsedPrice) {
        setError('Discounted price must be less than the original price.');
        return;
      }
      dataToSubmit.discountedPrice = parsedDiscountedPrice;
    } else {
      dataToSubmit.discountedPrice = undefined;
    }

    if (
      dataToSubmit.isForeign &&
      (dataToSubmit.origin === '' || dataToSubmit.origin.trim() === '')
    ) {
      setError('Origin is required if product is marked as foreign.');
      return;
    } else if (!dataToSubmit.isForeign) {
      dataToSubmit.origin = undefined;
    }

    if (dataToSubmit.collectionId === '') {
      dataToSubmit.collectionId = null;
    }

    // Prepare images for submission: new images as Base64, existing images as {url, public_id}
    dataToSubmit.images = formData.images.map((img) => {
      if (img.isNew) {
        return img.url; // Send Base64 for new images
      }
      return { url: img.url, public_id: img.public_id }; // Send existing objects
    });

    await updateProduct(productId, dataToSubmit); // Call updateProduct

    
    navigate(-1);
    
  };

  if (isGettingProducts) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading product data...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="px-4 py-12  bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Edit Product
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

          {/* Images Field */}
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

            {imagePreviews.length > 0 && (
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
              disabled={isUpdatingProduct} // Use isUpdatingProduct
            >
              {isUpdatingProduct ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update Product'
              )}
            </button>
          </div>

          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-md"
              onClick={() => navigate('/admin/dashboard?section=products')}
              disabled={isUpdatingProduct}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminEditProductPage;
