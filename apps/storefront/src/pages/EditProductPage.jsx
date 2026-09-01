// src/pages/AdminEditProductPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { ChevronDown, ChevronUp, Loader2, Search, XCircle } from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore'; // Assuming this provides collections
import { useAdminStore } from '../store/useAdminStore';
import AdminPageShell from '../components/admin/AdminPageShell'; // Assuming this provides updateProduct
import { useProductsStore } from '../store/useProductsStore'; // Assuming this provides getProductById

const AdminEditProductPage = () => {
  const { productId } = useParams();
  const { updateProduct, isUpdatingProduct } = useAdminStore();
  const { getProductById, isGettingProducts } = useProductsStore();
  const navigate = useNavigate();

  const editorRef = useRef(null);

  const handleEditorInit = (evt, editor) => {
    editorRef.current = editor;
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    items: '',
    price: '',
    leadTimeDays: '',
    shippingMinDays: '',
    shippingMaxDays: '',
    category: '',
    style: '',
    collectionId: '',
    images: [], // This will store a mix of {url, public_id} and {url: base64, isNew: true}
    isBestSeller: false,
    isPromo: false,
    discountedPrice: '',
    isForeign: false,
    origin: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    seoSchemaJsonLd: '',
  });
  const [error, setError] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]); // Stores URLs for display

  const { collections, isGettingCollections, getCollections } =
    useCollectionStore();

  // For collection dropdown (if you still want the search/dropdown functionality)
  const [isCollectionDropdownOpen, setIsCollectionDropdownOpen] =
    useState(false);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Effect to fetch collections for the dropdown
  useEffect(() => {
    getCollections();
  }, [getCollections]);

  // Effect to fetch product data when component mounts or productId changes
  useEffect(() => {
    const fetchProductData = async () => {
      if (productId) {
        const productData = await getProductById(productId);
        if (productData) {
          setFormData({
            name: productData.name || '',
            description: productData.description || '',
            items: productData.items || '',
            price: productData.price || '',
            leadTimeDays:
              productData.leadTimeDays !== undefined
                ? productData.leadTimeDays
                : '',
            shippingMinDays:
              productData.shippingMinDays !== undefined
                ? productData.shippingMinDays
                : '',
            shippingMaxDays:
              productData.shippingMaxDays !== undefined
                ? productData.shippingMaxDays
                : '',
            category: productData.category || '',
            style: productData.style || '',
            collectionId: productData.collectionId?._id || '',
            images: productData.images || [], // Initialize with existing images from DB
            isBestSeller: productData.isBestSeller || false,
            isPromo: productData.isPromo || false,
            discountedPrice: productData.discountedPrice || '',
            isForeign: productData.isForeign || false,
            origin: productData.origin || '',
            seoTitle: productData.seoTitle || '',
            seoDescription: productData.seoDescription || '',
            seoKeywords: (productData.seoKeywords || []).join(', '),
            seoSchemaJsonLd: productData.seoSchemaJsonLd || '',
          });
          // Set image previews from existing image URLs
          setImagePreviews(productData.images?.map((img) => img.url) || []);
        } else {
          navigate('/admin/dashboard?section=products');
          // toast.error('Product not found or failed to load.');
        }
      }
    };
    fetchProductData();
  }, [productId, getProductById, navigate]);

  // Close collection dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCollectionDropdownOpen(false);
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

  // Corrected handleImageChange to handle multiple files and manage existing/new images
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files); // Get all selected files
    if (files.length === 0) return;

    setError(null); // Clear previous error

    const newImagesToProcess = [];
    const newPreviewsToProcess = [];
    let filesProcessedCount = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImagesToProcess.push({ url: reader.result, isNew: true }); // Mark as new Base64 image
        newPreviewsToProcess.push(reader.result);
        filesProcessedCount++;

        // If all files are processed, update state
        if (filesProcessedCount === files.length) {
          setFormData((prevData) => {
            // Filter out any *previous* new Base64 images that might have been selected
            // before this current selection. Keep only original Cloudinary images.
            const existingCloudinaryImages = prevData.images.filter(
              (img) => !img.isNew
            );
            return {
              ...prevData,
              images: [...existingCloudinaryImages, ...newImagesToProcess], // Combine existing and new
            };
          });
          setImagePreviews((prevPreviews) => {
            // Filter out any *previous* Base64 previews. Keep only original Cloudinary URLs.
            const existingCloudinaryPreviews = prevPreviews.filter(
              (url) => !url.startsWith('data:image')
            );
            return [...existingCloudinaryPreviews, ...newPreviewsToProcess]; // Combine existing and new previews
          });
        }
      };
      reader.onerror = () => {
        setError('Failed to read image file.');
        // toast.error('Failed to read image file.');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = null; // Clear the input so same file(s) can be selected again
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

    // Client-side validation for description
    const strippedDescription = htmlDescription.replace(/<[^>]*>/g, '').trim();
    if (!strippedDescription) {
      setError('Description cannot be empty.');
      return;
    }

    // IMPORTANT: Only update the description field in dataToSubmit.
    // All other fields and their processing remain exactly as they were.
    const cleanedSeoKeywords = formData.seoKeywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword);

    const dataToSubmit = {
      ...formData,
      description: htmlDescription,
      seoKeywords: cleanedSeoKeywords,
    };

    // const dataToSubmit = { ...formData };

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
      dataToSubmit.discountedPrice = undefined; // Set to undefined, not empty string
    }

    if (
      dataToSubmit.isForeign &&
      (dataToSubmit.origin === '' || dataToSubmit.origin.trim() === '')
    ) {
      setError('Origin is required if product is marked as foreign.');
      return;
    } else if (!dataToSubmit.isForeign) {
      dataToSubmit.origin = undefined; // Set to undefined if not foreign
    }

    if (
      dataToSubmit.shippingMinDays !== '' &&
      dataToSubmit.shippingMaxDays !== '' &&
      parseInt(dataToSubmit.shippingMaxDays, 10) <
        parseInt(dataToSubmit.shippingMinDays, 10)
    ) {
      setError('Shipping max days must be greater than or equal to min days.');
      return;
    }

    if (dataToSubmit.collectionId === '') {
      dataToSubmit.collectionId = null;
    }

    // Prepare images for submission: new images as Base64, existing images as {url, public_id}
    // This mapping is correct IF formData.images is correctly structured
    dataToSubmit.images = formData.images.map((img) => {
      if (img.isNew) {
        return { url: img.url, isNew: true }; // Send {url: base64, isNew: true} for new images
      }
      return { url: img.url, public_id: true }; // Send existing objects
    });

    // console.log(
    //   'Data to submit (images field) from frontend:',
    //   JSON.stringify(dataToSubmit.images)
    // ); // DEBUG LOG

    await updateProduct(productId, dataToSubmit);

    navigate(-1); // Go back to previous page (e.g., admin dashboard)
  };

  // For collection dropdown filtering
  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
  );

  const selectedCollectionName =
    collections.find((c) => c._id === formData.collectionId)?.name ||
    'Select a collection (Optional)';

  if (isGettingProducts || isGettingCollections) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading product data...</p>
      </div>
    );
  }

  return (
    <AdminPageShell title="Edit Product">
      <div className="bg-base-100 border border-base-200 p-6 w-full max-w-3xl">

        {error && (
          <div role="alert" className="alert alert-error mb-4 rounded-none">
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
              className="input input-bordered w-full rounded-none"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <Editor
              onInit={handleEditorInit}
              apiKey="esh5bav8bmcm4mdbribpsniybxdqty6jszu5ctwihsw35a5y" // <--- IMPORTANT: Replace with your TinyMCE API key
              initialValue={formData.description} // Set initial value from fetched product data
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

          <div className="form-control">
            <label className="label">
              <span className="label-text">Items</span>
            </label>
            <textarea
              name="items"
              placeholder="(3+3+1+1) with Center Table Or Bed+Wardrobe..."
              className="textarea textarea-bordered h-24 w-full rounded-none"
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
              className="input input-bordered w-full rounded-none"
              value={Number(formData.price).toFixed(2)}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Lead Time (days)</span>
              </label>
              <input
                type="number"
                name="leadTimeDays"
                placeholder="0"
                min="0"
                className="input input-bordered w-full rounded-none"
                value={formData.leadTimeDays}
                onChange={handleChange}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Shipping Min (days)</span>
              </label>
              <input
                type="number"
                name="shippingMinDays"
                placeholder="0"
                min="0"
                className="input input-bordered w-full rounded-none"
                value={formData.shippingMinDays}
                onChange={handleChange}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Shipping Max (days)</span>
              </label>
              <input
                type="number"
                name="shippingMaxDays"
                placeholder="0"
                min="0"
                className="input input-bordered w-full rounded-none"
                value={formData.shippingMaxDays}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Category</span>
            </label>
            <select
              name="category"
              className="select select-bordered w-full rounded-none"
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
              {/* Add more categories as needed */}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Style</span>
            </label>
            <select
              name="style"
              className="select select-bordered w-full rounded-none"
              value={formData.style}
              onChange={handleChange}
              required
            >
              <option value="">Select a style</option>
              <option value="Modern">Modern</option>
              <option value="Contemporary">Contemporary</option>
              <option value="Antique/Royal">Antique/Royal</option>
              <option value="Bespoke">Bespoke</option>
              <option value="Minimalist">Minimalist</option>
              <option value="Glam">Glam</option>
              {/* Add more categories as needed */}
            </select>
          </div>

          {/* Collection Selection Dropdown (using previous dropdown style) */}
          <div className="form-control relative" ref={dropdownRef}>
            <label className="label">
              <span className="label-text">
                Assign to Collection (Optional)
              </span>
            </label>
            <div
              className="input input-bordered w-full rounded-none flex items-center justify-between cursor-pointer"
              onClick={() =>
                setIsCollectionDropdownOpen(!isCollectionDropdownOpen)
              }
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsCollectionDropdownOpen(!isCollectionDropdownOpen);
                }
              }}
            >
              <span>{selectedCollectionName}</span>
              {isCollectionDropdownOpen ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </div>

            {isCollectionDropdownOpen && (
              <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-none shadow-lg mt-1 max-h-60 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-base-100 border-b border-base-300 z-20">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral/40"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search collections..."
                      className="input input-bordered w-full pl-10 pr-3 rounded-none"
                      value={collectionSearchQuery}
                      onChange={(e) => setCollectionSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                {isGettingCollections ? (
                  <div className="p-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p>Loading collections...</p>
                  </div>
                ) : collections && collections.length > 0 ? (
                  <ul className="menu p-0">
                    <li>
                      <button
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            collectionId: '',
                          }));
                          setIsCollectionDropdownOpen(false);
                          setCollectionSearchQuery('');
                        }}
                        className={`w-full text-left p-2 hover:bg-base-200 rounded-none ${
                          formData.collectionId === ''
                            ? 'font-bold bg-base-200'
                            : ''
                        }`}
                      >
                        No Collection
                      </button>
                    </li>
                    {filteredCollections.map((collection) => (
                      <li key={collection._id}>
                        <button
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              collectionId: collection._id,
                            }));
                            setIsCollectionDropdownOpen(false);
                            setCollectionSearchQuery('');
                          }}
                          className={`w-full text-left p-2 hover:bg-base-200 rounded-none ${
                            formData.collectionId === collection._id
                              ? 'font-bold bg-base-200'
                              : ''
                          }`}
                        >
                          {collection.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-neutral/60">
                    No collections available
                  </div>
                )}
              </div>
            )}
          </div>

          {formData.collectionId && (
            <p className="text-sm text-neutral/60 mt-2">
              Selected: {selectedCollectionName}
            </p>
          )}

          {/* Images Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Product Images</span>
            </label>
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple // Keep multiple attribute
              className="file-input file-input-bordered w-full rounded-none"
              onChange={handleImageChange}
            />
            <p className="text-sm text-neutral/60 mt-1">
              Select one or more images. New selections will replace previously
              added *new* images, but existing Cloudinary images will be
              retained.
            </p>

            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imagePreviews.map((previewUrl, index) => (
                  <div
                    key={index}
                    className="relative group w-full h-24 sm:h-32 rounded-none overflow-hidden shadow-sm border border-gray-200"
                  >
                    <img
                      src={previewUrl}
                      alt={`Product Preview ${index + 1}`}
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

          <div className="form-control">
            <label className="label">
              <span className="label-text">Best Seller</span>
            </label>
            <input
              type="checkbox"
              name="isBestSeller"
              className="checkbox checkbox-primary self-start"
              checked={formData.isBestSeller}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">On Promotion</span>
            </label>
            <input
              type="checkbox"
              name="isPromo"
              className="checkbox checkbox-primary self-start"
              checked={formData.isPromo}
              onChange={handleChange}
            />
          </div>

          {formData.isPromo && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Discounted Price (₦)</span>
              </label>
              <input
                type="number"
                name="discountedPrice"
                placeholder="e.g., 399.99"
                step="0.01"
                className="input input-bordered w-full rounded-none"
                value={Number(formData.discountedPrice).toFixed(2)}
                onChange={handleChange}
                required={formData.isPromo}
              />
            </div>
          )}

          <div className="form-control">
            <label className="label">
              <span className="label-text">Foreign Product</span>
            </label>
            <input
              type="checkbox"
              name="isForeign"
              className="checkbox checkbox-primary self-start"
              checked={formData.isForeign}
              onChange={handleChange}
            />
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
                className="input input-bordered w-full rounded-none"
                value={formData.origin}
                onChange={handleChange}
                required={formData.isForeign}
              />
            </div>
          )}

          <div className="divider">SEO</div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">SEO Title</span>
            </label>
            <input
              type="text"
              name="seoTitle"
              placeholder="Short, descriptive title for search"
              className="input input-bordered w-full rounded-none"
              value={formData.seoTitle}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">SEO Description</span>
            </label>
            <textarea
              name="seoDescription"
              placeholder="Meta description for search results"
              className="textarea textarea-bordered h-24 w-full rounded-none"
              value={formData.seoDescription}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">SEO Keywords</span>
            </label>
            <input
              type="text"
              name="seoKeywords"
              placeholder="e.g., modern sofa, luxury seating"
              className="input input-bordered w-full rounded-none"
              value={formData.seoKeywords}
              onChange={handleChange}
            />
            <p className="text-sm text-neutral/60 mt-1">
              Separate keywords with commas.
            </p>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">SEO Schema (JSON-LD)</span>
            </label>
            <textarea
              name="seoSchemaJsonLd"
              placeholder='{"@context":"https://schema.org","@type":"Product"}'
              className="textarea textarea-bordered h-28 w-full rounded-none"
              value={formData.seoSchemaJsonLd}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="form-control mt-6">
            <button
              type="submit"
              className="btn btn-primary w-full text-lg font-semibold py-3 rounded-none shadow-md hover:shadow-lg transition duration-200 font-heading"
              disabled={isUpdatingProduct}
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
              className="btn btn-ghost w-full text-lg font-semibold py-3 rounded-none"
              onClick={() => navigate('/admin/dashboard?section=products')}
              disabled={isUpdatingProduct}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AdminPageShell>
  );
};

export default AdminEditProductPage;
