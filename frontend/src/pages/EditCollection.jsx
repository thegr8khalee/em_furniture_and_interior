// src/pages/AdminEditCollectionPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // NEW: Import useParams
// import { toast } from 'react-toastify'; // For notifications
import { Loader2, XCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useAdminStore } from '../store/useAdminStore';
import { useProductsStore } from '../store/useProductsStore';
import { useCollectionStore } from '../store/useCollectionStore';

const EditCollection = () => {
  const { collectionId } = useParams(); // Get collection ID from URL
  const { isGettingCollection, isUpdatingCollection, updateCollection } =
    useAdminStore();

  const { getCollectionById } = useCollectionStore();
  const { products, getProducts, isGettingProducts } = useProductsStore();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    style: '',
    productIds: [], // Array to hold selected product IDs
    isBestSeller: false,
    isPromo: false,
    coverImage: null, // Will store Base64 string for new image, or {url, public_id} for existing
    discountedPrice: '',
  });
  const [error, setError] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);

  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Effect to fetch all products for the multi-select dropdown
  useEffect(() => {
    getProducts();
  }, [getProducts]);

  // Effect to fetch collection data when component mounts or collectionId changes
  useEffect(() => {
    const fetchCollectionData = async () => {
      if (collectionId) {
        // NOTE: This should be collectionId, not productId
        // Corrected to collectionId from productId
        const collectionData = await getCollectionById(collectionId);
        if (collectionData) {
          setFormData({
            name: collectionData.name || '',
            style: collectionData.style || '',
            description: collectionData.description || '',
            // items: collectionData.items || '',
            price: collectionData.price || '', // Keep as string for input
            // NEW: Ensure productIds is always an array before mapping
            productIds: Array.isArray(collectionData.productIds)
              ? collectionData.productIds.map((p) => p._id)
              : [],
            isBestSeller: collectionData.isBestSeller || false,
            isPromo: collectionData.isPromo || false,
            coverImage: collectionData.coverImage || null, // Will be {url, public_id} object
            discountedPrice: collectionData.discountedPrice || '', // Keep as string for input
          });
          // Set cover image preview from existing image URL
          setCoverImagePreview(collectionData.coverImage?.url || null);
        } else {
          // Collection not found or error fetching
          navigate('/admin/dashboard?section=collections'); // Redirect back
          // toast.error('Collection not found or failed to load.');
        }
      }
    };
    fetchCollectionData();
  }, [collectionId, getCollectionById, navigate]); // Dependency array: collectionId, getCollectionById, navigate

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prevData) => {
      const newData = { ...prevData };

      if (type === 'checkbox') {
        newData[name] = checked;
        if (name === 'isPromo' && !checked) {
          newData.discountedPrice = '';
        }
      } else {
        newData[name] = value;
      }
      return newData;
    });
    setError(null);
  };

  const handleProductToggle = (productId) => {
    setFormData((prevData) => {
      // Ensure prevData.productIds is an array before using filter/includes
      const currentProductIds = Array.isArray(prevData.productIds)
        ? prevData.productIds
        : [];
      const newProductIds = currentProductIds.includes(productId)
        ? currentProductIds.filter((id) => id !== productId)
        : [...currentProductIds, productId];
      return { ...prevData, productIds: newProductIds };
    });
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFormData((prevData) => ({ ...prevData, coverImage: null }));
      setCoverImagePreview(null);
      return;
    }

    e.target.value = null;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prevData) => ({ ...prevData, coverImage: reader.result })); // Store Base64 string for new image
      setCoverImagePreview(reader.result);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read cover image file.');
      // toast.error('Failed to read cover image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCoverImage = () => {
    setFormData((prevData) => ({ ...prevData, coverImage: null })); // Explicitly set to null to indicate removal
    setCoverImagePreview(null);
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

    // Client-side validation for required fields
    if (dataToSubmit.description.trim() === '') {
      setError('Description is required.');
      return;
    }
    // if (dataToSubmit.items.trim() === '') {
    //   setError('Items is required.');
    //   return;
    // }
    if (dataToSubmit.productIds.length === 0) {
      setError('At least one product must be selected for the collection.');
      return;
    }
    if (!dataToSubmit.coverImage) {
      setError('Cover image is required.');
      return;
    }

    if (dataToSubmit.isPromo) {
      if (isNaN(parsedDiscountedPrice) || parsedDiscountedPrice <= 0) {
        setError(
          'Discounted price is required and must be greater than 0 if collection is on promotion.'
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

    // Prepare coverImage for submission:
    // If it's a Base64 string (newly selected), send as is.
    // If it's null (removed), send as is.
    // If it's an object {url, public_id} (existing and not changed), send as is.
    // The backend will handle the logic of deleting old image and uploading new one.

    await updateCollection(collectionId, dataToSubmit); // Call updateCollection

    navigate('/admin/dashboard?section=collections');
  };

  // Filter products based on search query
  // Ensure products is an array before calling filter
  const filteredProducts = (products || []).filter((product) =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  // Get selected product names for display
  // Ensure formData.productIds is an array before calling map
  const selectedProductNames = (formData.productIds || [])
    .map((id) => products.find((p) => p._id === id)?.name)
    .filter(Boolean);

  if (isGettingCollection || isGettingProducts) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading collection data...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200 pt-16">
      <div className="p-4 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Edit Collection
        </h2>

        {error && (
          <div role="alert" className="alert alert-error mb-4 rounded-md">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Collection Name</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g., Scandinavian Simplicity"
              className="input input-bordered w-full rounded-md"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Description<span className="text-red-500">*</span>
              </span>
            </label>
            <textarea
              name="description"
              placeholder="A collection inspired by minimalist design..."
              className="textarea textarea-bordered h-24 w-full rounded-md"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          {/* <div className="form-control">
            <label className="label">
              <span className="label-text">
                Items<span className="text-red-500">*</span>
              </span>
            </label>
            <textarea
              name="items"
              placeholder="A collection inspired by minimalist design..."
              className="textarea textarea-bordered h-24 w-full rounded-md"
              value={formData.items}
              onChange={handleChange}
              required
            ></textarea>
          </div> */}

          <div className="form-control">
            <label className="label">
              <span className="label-text">Price (₦)</span>
            </label>
            <input
              type="number"
              name="price"
              placeholder="1999.99"
              step="0.01"
              className="input input-bordered w-full rounded-md"
              value={Number(formData.price).toFixed(2)}
              onChange={handleChange}
              required
            />
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

          {/* Product Selection Dropdown */}
          <div className="form-control relative" ref={dropdownRef}>
            <label className="label">
              <span className="label-text">
                Products in Collection<span className="text-red-500">*</span>
              </span>
            </label>
            <div
              className="input input-bordered h-auto py-1 w-full rounded-md flex items-center justify-between cursor-pointer"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsProductDropdownOpen(!isProductDropdownOpen);
                }
              }}
            >
              {selectedProductNames.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {selectedProductNames.map((name, index) => (
                    <span
                      key={index}
                      className="badge badge-primary badge-outline"
                    >
                      {name}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-gray-400">Select products...</span>
              )}
              {isProductDropdownOpen ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </div>

            {isProductDropdownOpen && (
              <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-base-100 border-b border-base-300 z-20">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search products..."
                      className="input input-bordered w-full pl-10 pr-3 rounded-md"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                {isGettingProducts ? (
                  <div className="p-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p>Loading products...</p>
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <ul className="menu p-0">
                    {filteredProducts.map((product) => (
                      <li key={product._id}>
                        <label className="flex items-center justify-between w-full p-2 cursor-pointer hover:bg-base-200 rounded-none">
                          <span>
                            {product.name} (${product.price?.toFixed(2)})
                          </span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary"
                            checked={formData.productIds.includes(product._id)}
                            onChange={() => handleProductToggle(product._id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No products found.
                  </div>
                )}
              </div>
            )}
            {selectedProductNames.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Selected: {selectedProductNames.join(', ')}
              </p>
            )}
          </div>

          {/* Cover Image Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Collection Cover Image<span className="text-red-500">*</span>
              </span>
            </label>
            <input
              type="file"
              name="coverImage"
              accept="image/*"
              className="file-input file-input-bordered w-full rounded-md"
              onChange={handleCoverImageChange}
              // The 'required' attribute is not used here because we handle existing images
              // and explicit removal, so client-side JS validation is needed.
            />
            <p className="text-sm text-gray-500 mt-1">
              Select a single cover image.
            </p>

            {coverImagePreview && (
              <div className="mt-4 relative group w-48 h-32 mx-auto">
                <img
                  src={coverImagePreview}
                  alt="Cover Preview"
                  className="w-full h-full object-cover rounded-md shadow-sm border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveCoverImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label="Remove cover image"
                >
                  <XCircle size={20} />
                </button>
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Is Best Seller Collection?</span>
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
                placeholder="e.g., 1499.99"
                step="0.01"
                className="input input-bordered w-full rounded-md"
                value={Number(formData.discountedPrice).toFixed(2)}
                onChange={handleChange}
                required={formData.isPromo}
              />
            </div>
          )}

          <div className="form-control mt-6">
            <button
              type="submit"
              className="btn btn-primary w-full text-lg font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black font-[poppins]"
              disabled={isUpdatingCollection}
            >
              {isUpdatingCollection ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update Collection'
              )}
            </button>
          </div>

          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-md"
              onClick={() => navigate('/admin/dashboard?section=collections')}
              disabled={isUpdatingCollection}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCollection;
