// src/pages/AdminAddCollectionPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import { toast } from 'react-toastify'; // For notifications
import { ChevronDown, ChevronUp, Loader2, Search, XCircle } from 'lucide-react'; // For loading spinner and remove icon
import { useAdminStore } from '../store/useAdminStore'; // Import useAdminStore for addCollection and getProducts
import { useProductsStore } from '../store/useProductsStore';

const AddCollection = () => {
  const { addCollection, isAddingCollection } = useAdminStore();
  const { getProducts, isGettingProducts, products } = useProductsStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    style:'',
    productIds: [], // Array to hold selected product IDs
    isBestSeller: false,
    isPromo: false,
    coverImage: null,
    discountedPrice: '',
  });
  const [error, setError] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);

  // NEW: State for product selection dropdown
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const dropdownRef = useRef(null); // Ref for detecting clicks outside the dropdown

  // Fetch all products when the component mounts
  useEffect(() => {
    getProducts();
  }, [getProducts]);

  // NEW: Close dropdown when clicking outside
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

  // NEW: Handle product selection/deselection
  const handleProductToggle = (productId) => {
    setFormData((prevData) => {
      const newProductIds = prevData.productIds.includes(productId)
        ? prevData.productIds.filter((id) => id !== productId)
        : [...prevData.productIds, productId];
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
      setFormData((prevData) => ({ ...prevData, coverImage: reader.result }));
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
    setFormData((prevData) => ({ ...prevData, coverImage: null }));
    setCoverImagePreview(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (formData.productIds.length === 0) {
      setError('Please select at least one product for the collection.');
      return;
    }

    if (!formData.coverImage) {
      setError('Please upload a cover image for the collection.');
      return;
    }

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

    if (!dataToSubmit.coverImage) {
      dataToSubmit.coverImage = null;
    } else if (
      typeof dataToSubmit.coverImage === 'string' &&
      dataToSubmit.coverImage.startsWith('data:image')
    ) {
      // It's a new Base64 image, send as is
    } else {
      // If it's an object from existing data (e.g., { url, public_id }), send only the url
      dataToSubmit.coverImage = dataToSubmit.coverImage.url;
    }

    await addCollection(dataToSubmit);

    navigate('/admin/dashboard?section=collections');
  };

  // Filter products based on search query
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  // Get selected product names for display
  const selectedProductNames = formData.productIds
    .map((id) => products.find((p) => p._id === id)?.name)
    .filter(Boolean); // Filter out any undefined names

  return (
    <div className="flex justify-center items-start min-h-screen py-8 bg-base-200">
      <div className="px-4 py-12 bg-base-100 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-6 text-primary font-[poppins]">
          Add New Collection
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
              <span className="label-text">Description</span>
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

          <div className="form-control">
            <label className="label">
              <span className="label-text">Price ($)</span>
            </label>
            <input
              type="number"
              name="price"
              placeholder="1999.99"
              step="0.01"
              className="input input-bordered w-full rounded-md"
              value={formData.price}
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

          {/* Product IDs Multi-select */}
          <div className="form-control relative" ref={dropdownRef}>
            <label className="label">
              <span className="label-text">
                Products in Collection <span className="text-red-500">*</span>
              </span>
            </label>
            <div
              className="input input-bordered w-full rounded-md flex items-center justify-between cursor-pointer"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              tabIndex="0" // Make div focusable for accessibility
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
                  <ul className="menu p-2 w-full">
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
                            onClick={(e) => e.stopPropagation()} // Prevent closing dropdown when clicking checkbox
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
                Collection Cover Image <span className="text-red-500">*</span>
              </span>
            </label>
            <input
              type="file"
              name="coverImage"
              accept="image/*"
              className="file-input file-input-bordered w-full rounded-md"
              onChange={handleCoverImageChange}
              
            />
            <p className="text-sm text-gray-500 mt-1">
              Select a single cover image.
            </p>

            {coverImagePreview && (
              <div className="mt-4 relative group w-48 h-32 mx-auto">
                {' '}
                {/* Centered preview */}
                <img
                  src={coverImagePreview}
                  alt="Cover Preview"
                  className="w-full h-full object-cover rounded-md shadow-sm border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveCoverImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 group-hover:opacity-100 transition-opacity duration-200"
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
                <span className="label-text">Discounted Price ($)</span>
              </label>
              <input
                type="number"
                name="discountedPrice"
                placeholder="e.g., 1499.99"
                step="0.01"
                className="input input-bordered w-full rounded-md"
                value={formData.discountedPrice}
                onChange={handleChange}
                required={formData.isPromo}
              />
            </div>
          )}

          <div className="form-control mt-6">
            <button
              type="submit"
              className="btn btn-primary w-full text-lg font-semibold py-3 rounded-md shadow-md hover:shadow-lg transition duration-200 text-black font-[poppins]"
              disabled={isAddingCollection}
            >
              {isAddingCollection ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Add Collection'
              )}
            </button>
          </div>

          <div className="form-control mt-4">
            <button
              type="button"
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-md"
              onClick={() => navigate('/admin/dashboard?section=collections')}
              disabled={isAddingCollection}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCollection;