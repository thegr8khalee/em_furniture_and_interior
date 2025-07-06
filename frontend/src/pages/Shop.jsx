// src/pages/ShopPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  ShoppingCart,
  Heart,
} from 'lucide-react';
import FilterModal from '../components/FilterModal';
import { useProductsStore } from '../store/useProductsStore';
// import { useAdminStore } from '../store/useAdminStore'; // To get collections data
import Hero1 from '../images/Hero1.png';
import whatsapp from '../images/whatsapp.png';
import { useCollectionStore } from '../store/useCollectionStore';
import { useLocation, useNavigate } from 'react-router-dom';

const ShopPage = () => {
  const location = useLocation();
  const { products, getProducts, isGettingProducts } = useProductsStore();
  const { collections, getCollections, isGettingCollections } =
    useCollectionStore();

  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('products');

  const productSearchInputRef = useRef(null);
  // Product-specific states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const [productSearchQuery, setProductSearchQuery] = useState(''); // Renamed from searchQuery to productSearchQuery
  const [minPriceProduct, setMinPriceProduct] = useState('');
  const [maxPriceProduct, setMaxPriceProduct] = useState('');
  const [isBestSellerFilterProduct, setIsBestSellerFilterProduct] =
    useState(false);
  const [isPromoFilterProduct, setIsPromoFilterProduct] = useState(false);
  const [isForeignFilterProduct, setIsForeignFilterProduct] = useState(false);
  const [isForeignFilterCollection, setIsForeignFilterCollection] =
    useState(false);
  const [isPriceFilterAppliedProduct, setIsPriceFilterAppliedProduct] =
    useState(false);
  const [isProductFilterModalOpen, setIsProductFilterModalOpen] =
    useState(false); // Renamed from isFilterModalOpen

  // Collection-specific states
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [minPriceCollection, setMinPriceCollection] = useState('');
  const [maxPriceCollection, setMaxPriceCollection] = useState('');
  const [isBestSellerFilterCollection, setIsBestSellerFilterCollection] =
    useState(false);
  const [isPromoFilterCollection, setIsPromoFilterCollection] = useState(false);
  const [isPriceFilterAppliedCollection, setIsPriceFilterAppliedCollection] =
    useState(false);
  const [isCollectionFilterModalOpen, setIsCollectionFilterModalOpen] =
    useState(false);

  // Fetch products AND collections on component mount
  useEffect(() => {
    getProducts();
    getCollections();
  }, [getProducts, getCollections]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const categoryFromUrl = queryParams.get('category');
    const viewFromUrl = queryParams.get('view');

    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
      setViewMode('products');
    } else if (viewFromUrl === 'collections') {
      setViewMode('collections');
    }
  }, [location.search]);

  // NEW: Dedicated useEffect for focusing the search bar
  useEffect(() => {
    // Check if focusSearch state was passed and if the ref is available
    if (location.state?.focusSearch && productSearchInputRef.current) {
      // Ensure we are in the 'products' view mode before attempting to focus
      // as the search bar is only visible in this mode.
      if (viewMode === 'products') {
        productSearchInputRef.current.focus();
        // Clear the state after focusing to prevent re-focusing on subsequent renders
        // This uses `replace: true` so it doesn't add a new entry to browser history.
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state?.focusSearch, productSearchInputRef, viewMode, navigate]);

  // NEW: Effect to read category from URL on initial load
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const categoryFromUrl = queryParams.get('category');
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
      setViewMode('products'); // Ensure we are in products view if a category is selected
    }
  }, [location.search]); // Re-run if URL search params change

  // Effect to extract unique categories once products are loaded
  useEffect(() => {
    if (products.length > 0) {
      const categoriesSet = new Set();
      products.forEach((product) => {
        if (product.category) {
          categoriesSet.add(product.category);
        }
      });
      setUniqueCategories(Array.from(categoriesSet).sort());
    } else {
      setUniqueCategories([]);
    }
  }, [products]);

  // Effect to filter PRODUCTS based on all criteria
  useEffect(() => {
    let currentProducts = products;

    // 1. Apply Search Query Filter
    if (productSearchQuery.trim() !== '') {
      const lowerCaseQuery = productSearchQuery.toLowerCase();
      currentProducts = currentProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(lowerCaseQuery) ||
          product.description.toLowerCase().includes(lowerCaseQuery)
      );
    }

    // 2. Apply Category Filter
    if (selectedCategory !== 'all') {
      currentProducts = currentProducts.filter(
        (product) => product.category === selectedCategory
      );
    }

    // 3. Apply Price Filter
    const parsedMinPrice = parseFloat(minPriceProduct);
    const parsedMaxPrice = parseFloat(maxPriceProduct);

    if (isPriceFilterAppliedProduct) {
      if (!isNaN(parsedMinPrice)) {
        currentProducts = currentProducts.filter(
          (product) => product.price >= parsedMinPrice
        );
      }
      if (!isNaN(parsedMaxPrice)) {
        currentProducts = currentProducts.filter(
          (product) => product.price <= parsedMaxPrice
        );
      }
    }

    // 4. Apply Best Seller Filter
    if (isBestSellerFilterProduct) {
      currentProducts = currentProducts.filter(
        (product) => product.isBestSeller
      );
    }

    // 5. Apply Promo Filter
    if (isPromoFilterProduct) {
      currentProducts = currentProducts.filter((product) => product.isPromo);
    }

    // 6. Apply Foreign Filter
    if (isForeignFilterProduct) {
      currentProducts = currentProducts.filter((product) => product.isForeign);
    }

    // console.log(filteredProducts);

    setFilteredProducts(currentProducts);
  }, [
    products,
    productSearchQuery,
    selectedCategory,
    minPriceProduct,
    maxPriceProduct,
    isBestSellerFilterProduct,
    isPromoFilterProduct,
    isForeignFilterProduct,
    isPriceFilterAppliedProduct,
    filteredProducts,
  ]);

  // Effect to filter COLLECTIONS based on all criteria
  useEffect(() => {
    let currentCollections = collections;

    // 1. Apply Search Query Filter
    if (collectionSearchQuery.trim() !== '') {
      const lowerCaseQuery = collectionSearchQuery.toLowerCase();
      currentCollections = currentCollections.filter(
        (collection) =>
          collection.name.toLowerCase().includes(lowerCaseQuery) ||
          collection.description.toLowerCase().includes(lowerCaseQuery)
      );
    }

    // 2. Apply Price Filter (assuming collections have a 'price' field for filtering)
    const parsedMinPrice = parseFloat(minPriceCollection);
    const parsedMaxPrice = parseFloat(maxPriceCollection);

    if (isPriceFilterAppliedCollection) {
      if (!isNaN(parsedMinPrice)) {
        currentCollections = currentCollections.filter(
          (collection) => collection.price >= parsedMinPrice
        );
      }
      if (!isNaN(parsedMaxPrice)) {
        currentCollections = currentCollections.filter(
          (collection) => collection.price <= parsedMaxPrice
        );
      }
    }

    // 3. Apply Best Seller Filter (assuming collections have an 'isBestSeller' field)
    if (isBestSellerFilterCollection) {
      currentCollections = currentCollections.filter(
        (collection) => collection.isBestSeller
      );
    }

    // 4. Apply Promo Filter (assuming collections have an 'isPromo' field)
    if (isPromoFilterCollection) {
      currentCollections = currentCollections.filter(
        (collection) => collection.isPromo
      );
    }

    if (isForeignFilterCollection) {
      currentCollections = currentCollections.filter(
        (collection) => collection.isForeign
      );
    }

    setFilteredCollections(currentCollections);
  }, [
    collections,
    isForeignFilterCollection,
    collectionSearchQuery,
    minPriceCollection,
    maxPriceCollection,
    isBestSellerFilterCollection,
    isPromoFilterCollection,
    isPriceFilterAppliedCollection,
  ]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle category selection and close dropdown
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
  };

  // Filter categories based on search query
  const filteredCategories = uniqueCategories.filter((category) =>
    category.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  // Handlers for Product Filter Modal
  const handleOpenProductFilterModal = () => setIsProductFilterModalOpen(true);
  const handleCloseProductFilterModal = () =>
    setIsProductFilterModalOpen(false);
  const handleApplyProductFilters = () => {
    setIsProductFilterModalOpen(false);
  };
  const handleClearProductFilters = () => {
    setMinPriceProduct('');
    setMaxPriceProduct('');
    setIsBestSellerFilterProduct(false);
    setIsPromoFilterProduct(false);
    setIsForeignFilterProduct(false);
    setIsPriceFilterAppliedProduct(false);
    setIsProductFilterModalOpen(false);
  };

  // Handlers for Collection Filter Modal
  const handleOpenCollectionFilterModal = () =>
    setIsCollectionFilterModalOpen(true);
  const handleCloseCollectionFilterModal = () =>
    setIsCollectionFilterModalOpen(false);
  const handleApplyCollectionFilters = () => {
    setIsCollectionFilterModalOpen(false);
  };
  const handleClearCollectionFilters = () => {
    setMinPriceCollection(''); // Corrected setter name
    setMaxPriceCollection(''); // Corrected setter name
    setIsBestSellerFilterCollection(false);
    setIsPromoFilterCollection(false);
    setIsForeignFilterCollection(false);
    setIsPriceFilterAppliedCollection(false);
    setIsCollectionFilterModalOpen(false);
  };

  const handleProductClick = (Id) => {
    navigate(`/product/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  };

  const handleCollectionClick = (Id) => {
    navigate(`/collection/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

//   console.log(location.state)

  // Combined loading state
  if (isGettingProducts || isGettingCollections) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading shop data...</p>
      </div>
    );
  }

  // if (adminError) {
  //     return (
  //         <div role="alert" className="alert alert-error my-8 mx-auto w-full max-w-lg">
  //             <span>Error: {adminError}</span>
  //         </div>
  //     );
  // }

  return (
    <div className="">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-50 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-15 left-1/2 -translate-x-1/2 mt-20 mb-2 text-5xl font-bold text-center text-base-100 font-[poppins]">
            Shop
          </h1>

          {/* Filters Section: Category Dropdown (conditionally rendered) */}
          <div className="absolute bottom-8 flex flex-col justify-center items-center gap-4 w-full">
            {viewMode === 'products' && (
              <div
                className="form-control relative w-full max-w-xs"
                ref={dropdownRef}
              >
                <div
                  className="input border-0 w-full bg-transparent rounded-md flex items-center justify-center cursor-pointer shadow-none"
                  onClick={() =>
                    setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                  }
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                    }
                  }}
                >
                  <span className="font-[montserrat] text-base-100 font-bold">
                    {selectedCategory === 'all'
                      ? 'All Products'
                      : selectedCategory}
                  </span>
                  {isCategoryDropdownOpen ? (
                    <ChevronUp className="stroke-base-100" />
                  ) : (
                    <ChevronDown className="stroke-base-100" />
                  )}
                </div>

                {isCategoryDropdownOpen && (
                  <div className="absolute z-101 w-full bg-base-100 border border-base-300 rounded-md shadow-lg mt-1 top-full max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-base-100 border-b border-base-300 z-20">
                      <div className="relative">
                        <Search
                          className="absolute z-100 left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <input
                          type="text"
                          placeholder="Search categories..."
                          className="input input-bordered w-full pl-10 pr-3 rounded-md"
                          value={categorySearchQuery}
                          onChange={(e) =>
                            setCategorySearchQuery(e.target.value)
                          }
                        />
                      </div>
                    </div>
                    {uniqueCategories.length === 0 &&
                    filteredCategories.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No categories found.
                      </div>
                    ) : (
                      <ul className="menu p-0 w-full">
                        <li>
                          <button
                            onClick={() => handleCategoryChange('all')}
                            className={`font-[montserrat] btn border-0 shadow-0 w-full p-2 hover:bg-base-200 rounded-none
                                                            ${
                                                              selectedCategory ===
                                                              'all'
                                                                ? 'font-bold bg-base-200'
                                                                : ''
                                                            }`}
                          >
                            All Products
                          </button>
                        </li>
                        {filteredCategories.map((category) => (
                          <li key={category}>
                            <button
                              onClick={() => handleCategoryChange(category)}
                              className={`font-[montserrat] btn border-0 shadow-0 bg-base-100 w-full text-left p-2 hover:bg-base-200 rounded-none
                                                                ${
                                                                  selectedCategory ===
                                                                  category
                                                                    ? 'font-bold bg-base-200'
                                                                    : ''
                                                                }`}
                            >
                              {category}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        {/* Products/Collections Switch */}
        <div className="flex justify-center my-5">
          <div className="tabs tabs-boxed space-x-4">
            <button
              className={`btn tab rounded-xl ${
                viewMode === 'products' ? 'tab-active bg-primary' : ''
              }`}
              onClick={() => setViewMode('products')}
            >
              Products
            </button>
            <button
              className={`btn tab rounded-xl ${
                viewMode === 'collections' ? 'tab-active bg-primary' : ''
              }`}
              onClick={() => setViewMode('collections')}
            >
              Collections
            </button>
          </div>
        </div>

        {/* Conditional Rendering based on viewMode */}
        {viewMode === 'products' ? (
          <>
            <div className="sm:flex w-full my-5">
              {/* Product Search Bar */}
              <div className="form-control w-full">
                <div className="relative">
                  <Search className="size-5 z-10 absolute left-3 top-1/2 stroke-gray-400 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products by name or description..."
                    className="input input-bordered w-full pl-10 pr-3 rounded-xl"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    ref={productSearchInputRef}
                  />
                </div>
              </div>
              {/* "More Filters" Button for Products */}
              <div className="form-control w-full sm:ml-2 sm:mt-0 mt-2 sm:w-auto">
                <button
                  className="btn text-secondary btn-primary rounded-xl w-full"
                  onClick={handleOpenProductFilterModal}
                >
                  <Filter size={20} /> Filters
                </button>
              </div>
            </div>

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center text-xl text-gray-600 mt-16">
                No products found for the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product._id}
                    className=" rounded-xl overflow-hidden"
                  >
                    <figure className="relative h-60 w-full overflow-hidden rounded-xl">
                      <button
                        className="w-full h-full"
                        onClick={() => handleProductClick(product._id)}
                      >
                        <img
                          src={
                            product.images && product.images.length > 0
                              ? product.images[0].url
                              : 'https://placehold.co/400x300/E0E0E0/333333?text=No+Image'
                          }
                          alt={product.name}
                          className="w-full h-full rounded-xl object-cover transform transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              'https://placehold.co/400x300/E0E0E0/333333?text=Image+Error';
                          }}
                        />
                      </button>

                      <button
                        className="absolute top-3 right-3"
                        aria-label="Add to wishlist"
                      >
                        <Heart className="text-primary size-7" />
                      </button>
                      <span className="absolute bottom-3 left-3 text-base text-shadow-lg truncate text-base-100 font-[montserrat]">
                        {product.style}{' '}
                        {product.collectionId && product.collectionId.name && (
                          <span className="text-sm mb-1">
                            | Collection: {product.collectionId.name}
                          </span>
                        )}
                      </span>
                    </figure>

                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold truncate">
                            {product.name}
                          </h2>
                          {product.isPromo &&
                          product.discountedPrice !== undefined ? (
                            <div className="flex flex-col">
                              <span className="text-red-600 font-bold text-xl">
                                N{product.discountedPrice.toFixed(2)}
                              </span>
                              <span className="text-gray-500 line-through text-sm">
                                N{product.price.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-xl">
                              N{product.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="space-x-1">
                          <button className="btn rounded-xl bg-green-400">
                            <img
                              src={whatsapp}
                              alt="WhatsApp"
                              className="size-5"
                            />
                          </button>
                          <button className="btn rounded-xl bg-primary">
                            <ShoppingCart className="" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Collections Grid with Search and Filters
          <>
            <div className="sm:flex w-full my-5">
              {/* Collection Search Bar */}
              <div className="form-control w-full">
                <div className="relative">
                  <Search className="size-5 z-10 absolute left-3 top-1/2 stroke-gray-400 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search collections by name or description..."
                    className="rounded-xl input input-bordered w-full pl-10 pr-3"
                    value={collectionSearchQuery}
                    onChange={(e) => setCollectionSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {/* "More Filters" Button for Collections */}
              <div className="form-control w-full sm:ml-2 sm:mt-0 mt-2 sm:w-auto">
                <button
                  className="btn text-secondary btn-primary rounded-xl w-full"
                  onClick={handleOpenCollectionFilterModal}
                >
                  <Filter size={20} /> Filters
                </button>
              </div>
            </div>

            {filteredCollections.length === 0 ? (
              <div className="text-center text-xl text-gray-600 mt-16">
                No collections found for the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredCollections.map((collection) => (
                  <div
                    key={collection._id}
                    className="rounded-xl overflow-hidden"
                  >
                    <figure className="relative h-60 w-full overflow-hidden rounded-xl">
                      <button
                        className="w-full h-full"
                        onClick={() => handleCollectionClick(collection._id)}
                      >
                        <img
                          src={
                            collection.coverImage?.url ||
                            'https://placehold.co/400x300/E0E0E0/333333?text=No+Image'
                          }
                          alt={collection.name}
                          className="w-full h-full rounded-xl object-cover transform transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              'https://placehold.co/400x300/E0E0E0/333333?text=Image+Error';
                          }}
                        />
                      </button>
                      <button
                        className="absolute top-3 right-3"
                        aria-label="Add to wishlist"
                      >
                        <Heart className="text-primary size-7" />
                      </button>
                      <span className="absolute bottom-3 left-3 text-base text-shadow-lg truncate text-base-100 font-[montserrat]">
                        {collection.style}
                      </span>
                    </figure>
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold truncate">
                            {collection.name}
                          </h2>
                          {collection.collectionId &&
                            collection.collectionId.name && (
                              <p className="text-sm text-gray-500 mb-1">
                                Collection: {collection.collectionId.name}
                              </p>
                            )}
                          {collection.isPromo &&
                          collection.discountedPrice !== undefined ? (
                            <div className="flex flex-col">
                              <span className="text-red-600 font-bold text-xl">
                                N{collection.discountedPrice.toFixed(2)}
                              </span>
                              <span className="text-gray-500 line-through text-sm">
                                N{collection.price.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-xl">
                              N{collection.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="space-x-1">
                          <button className="btn rounded-xl bg-green-400">
                            <img
                              src={whatsapp}
                              alt="WhatsApp"
                              className="size-5"
                            />
                          </button>
                          <button className="btn rounded-xl bg-primary">
                            <ShoppingCart className="" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Product Filter Modal Component */}
        <FilterModal
          isOpen={isProductFilterModalOpen}
          onClose={handleCloseProductFilterModal}
          minPrice={minPriceProduct}
          setMinPrice={setMinPriceProduct}
          maxPrice={maxPriceProduct}
          setMaxPrice={setMaxPriceProduct}
          isBestSellerFilter={isBestSellerFilterProduct}
          setIsBestSellerFilter={setIsBestSellerFilterProduct}
          isPromoFilter={isPromoFilterProduct}
          setIsPromoFilter={setIsPromoFilterProduct}
          isForeignFilter={isForeignFilterProduct} // This filter is only for products
          setIsForeignFilter={setIsForeignFilterProduct}
          setIsPriceFilterApplied={setIsPriceFilterAppliedProduct}
          onApplyFilters={handleApplyProductFilters}
          onClearFilters={handleClearProductFilters}
        />

        {/* NEW: Collection Filter Modal Component */}
        <FilterModal
          isOpen={isCollectionFilterModalOpen}
          onClose={handleCloseCollectionFilterModal}
          minPrice={minPriceCollection}
          setMinPrice={setMinPriceCollection}
          maxPrice={maxPriceCollection}
          setMaxPrice={setMaxPriceCollection}
          isBestSellerFilter={isBestSellerFilterCollection}
          setIsBestSellerFilter={setIsBestSellerFilterCollection}
          isPromoFilter={isPromoFilterCollection}
          setIsPromoFilter={setIsPromoFilterCollection}
          isForeignFilter={isForeignFilterCollection}
          setIsForeignFilter={setIsForeignFilterCollection}
          setIsPriceFilterApplied={setIsPriceFilterAppliedCollection}
          onApplyFilters={handleApplyCollectionFilters}
          onClearFilters={handleClearCollectionFilters}
        />
      </div>
    </div>
  );
};

export default ShopPage;
