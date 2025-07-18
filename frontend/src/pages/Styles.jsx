/* eslint-disable no-unused-vars */
// src/pages/Styles.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import Hero1 from '../images/Hero1.png';
import whatsapp from '../images/whatsapp.png';
import { useCollectionStore } from '../store/useCollectionStore';
import { useNavigate, useParams } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useAuthStore } from '../store/useAuthStore';

const ITEMS_PER_PAGE = 12;

const Styles = () => {
  const { style } = useParams();
  const navigate = useNavigate();

  // --- Zustand Store States and Actions ---
  const { products, getProducts, isGettingProducts, hasMoreProducts } =
    useProductsStore();
  const {
    collections,
    getCollections,
    isGettingCollections,
    hasMoreCollections,
  } = useCollectionStore();
  const { addToCart, isAddingToCart } = useCartStore();
  const {
    addToWishlist,
    isAddingToWishlist,
    wishlist,
    getwishlist,
    removeFromWishlist,
    isRemovingFromWishlist,
  } = useWishlistStore();
  const { isAdmin, checkAuth, isAuthReady } = useAuthStore();

  // --- View Mode State ('products' or 'collections') ---
  const [viewMode, setViewMode] = useState('products');

  // --- Product-specific Filter States ---
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const StyledropdownRef = useRef(null);

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [minPriceProduct, setMinPriceProduct] = useState('');
  const [maxPriceProduct, setMaxPriceProduct] = useState('');
  const [isBestSellerFilterProduct, setIsBestSellerFilterProduct] =
    useState(false);
  const [isPromoFilterProduct, setIsPromoFilterProduct] = useState(false);
  const [isForeignFilterProduct, setIsForeignFilterProduct] = useState(false);
  const [isPriceFilterAppliedProduct, setIsPriceFilterAppliedProduct] =
    useState(false);
  const [isProductFilterModalOpen, setIsProductFilterModalOpen] =
    useState(false);

  // --- Collection-specific Filter States ---
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [minPriceCollection, setMinPriceCollection] = useState('');
  const [maxPriceCollection, setMaxPriceCollection] = useState('');
  const [isBestSellerFilterCollection, setIsBestSellerFilterCollection] =
    useState(false);
  const [isPromoFilterCollection, setIsPromoFilterCollection] = useState(false);
  const [isForeignFilterCollection, setIsForeignFilterCollection] =
    useState(false);
  const [isPriceFilterAppliedCollection, setIsPriceFilterAppliedCollection] =
    useState(false);
  const [isCollectionFilterModalOpen, setIsCollectionFilterModalOpen] =
    useState(false);

  // --- Local Page States for Load More (tracks the next page to request) ---
  const [localPageProduct, setLocalPageProduct] = useState(1);
  const [localPageCollection, setLocalPageCollection] = useState(1);

  // --- Static Designs List (for style dropdown) ---
  const designs = [
    { id: '1', name: 'Modern', link: 'modern' },
    { id: '2', name: 'Contemporary', link: 'contemporary' },
    { id: '3', name: 'Antique/Royal', link: 'antique%2Froyal' },
    { id: '4', name: 'Bespoke', link: 'bespoke' },
    { id: '5', name: 'Minimalist', link: 'minimalist' },
    { id: '6', name: 'Glam', link: 'glam' },
  ];

  // --- Initial Auth Check ---
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // --- Fetch Wishlist ONLY when auth is ready and user is not admin ---
  useEffect(() => {
    if (isAuthReady && !isAdmin) {
      getwishlist();
    }
  }, [isAuthReady, getwishlist, isAdmin]);

  // --- Effect to extract unique categories once products are loaded ---
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

  // --- Filter Construction Callbacks (Memoized) ---
  const buildProductFilters = useCallback(() => {
    const filters = {};
    if (style) {
      filters.style = style;
    }
    if (productSearchQuery.trim() !== '') {
      filters.search = productSearchQuery.trim();
    }
    if (selectedCategory !== 'all') {
      filters.category = selectedCategory;
    }
    if (minPriceProduct !== '' && !isNaN(parseFloat(minPriceProduct))) {
      filters.minPrice = parseFloat(minPriceProduct);
    }
    if (maxPriceProduct !== '' && !isNaN(parseFloat(maxPriceProduct))) {
      filters.maxPrice = parseFloat(maxPriceProduct);
    }
    if (isBestSellerFilterProduct) {
      filters.isBestSeller = true;
    }
    if (isPromoFilterProduct) {
      filters.isPromo = true;
    }
    if (isForeignFilterProduct) {
      filters.isForeign = true;
    }
    return filters;
  }, [
    style,
    productSearchQuery,
    selectedCategory,
    minPriceProduct,
    maxPriceProduct,
    isBestSellerFilterProduct,
    isPromoFilterProduct,
    isForeignFilterProduct,
  ]);

  const buildCollectionFilters = useCallback(() => {
    const filters = {};
    if (style) {
      filters.style = style;
    }
    if (collectionSearchQuery.trim() !== '') {
      filters.search = collectionSearchQuery.trim();
    }
    if (minPriceCollection !== '' && !isNaN(parseFloat(minPriceCollection))) {
      filters.minPrice = parseFloat(minPriceCollection);
    }
    if (maxPriceCollection !== '' && !isNaN(parseFloat(maxPriceCollection))) {
      filters.maxPrice = parseFloat(maxPriceCollection);
    }
    if (isBestSellerFilterCollection) {
      filters.isBestSeller = true;
    }
    if (isPromoFilterCollection) {
      filters.isPromo = true;
    }
    if (isForeignFilterCollection) {
      filters.isForeign = true;
    }
    return filters;
  }, [
    style,
    collectionSearchQuery,
    minPriceCollection,
    maxPriceCollection,
    isBestSellerFilterCollection,
    isPromoFilterCollection,
    isForeignFilterCollection,
  ]);

  // --- Effects to Trigger Backend Fetches Based on Filter Changes (Initial Load & Filter Change) ---
  useEffect(() => {
    if (isAuthReady) {
      setLocalPageProduct(1);
      const filters = buildProductFilters();
      getProducts(1, ITEMS_PER_PAGE, filters, false);
    }
  }, [isAuthReady, buildProductFilters, getProducts]);

  useEffect(() => {
    if (isAuthReady) {
      setLocalPageCollection(1);
      const filters = buildCollectionFilters();
      getCollections(1, ITEMS_PER_PAGE, filters, false);
    }
  }, [isAuthReady, buildCollectionFilters, getCollections]);

  // --- Load More Handlers ---
  const handleLoadMoreProducts = () => {
    if (!isGettingProducts && hasMoreProducts) {
      const nextPage = localPageProduct + 1;
      const filters = buildProductFilters();
      getProducts(nextPage, ITEMS_PER_PAGE, filters, true);
      setLocalPageProduct(nextPage);
    }
  };

  const handleLoadMoreCollections = () => {
    if (!isGettingCollections && hasMoreCollections) {
      const nextPage = localPageCollection + 1;
      const filters = buildCollectionFilters();
      getCollections(nextPage, ITEMS_PER_PAGE, filters, true);
      setLocalPageCollection(nextPage);
    }
  };

  // --- Dropdown Logic (Category & Style) ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
      if (
        StyledropdownRef.current &&
        !StyledropdownRef.current.contains(event.target)
      ) {
        setIsStyleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
  };

  const handleStyleChange = (selectedStyleLink) => {
    navigate(`/styles/${selectedStyleLink}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
    setIsStyleDropdownOpen(false);
    setStyleSearchQuery('');
  };

  const filteredCategories = [
    'Living Room',
    'Armchair',
    'Bedroom',
    'Dining Room',
    'Center Table',
    'Wardrobe',
    'TV Unit',
    'Carpet',
  ];

  const filteredStyle = designs.filter((design) =>
    design.name.toLowerCase().includes(styleSearchQuery.toLowerCase())
  );

  // --- Product Filter Modal Handlers ---
  const handleOpenProductFilterModal = () => setIsProductFilterModalOpen(true);
  const handleCloseProductFilterModal = () =>
    setIsProductFilterModalOpen(false);
  const handleApplyProductFilters = () => {
    setIsProductFilterModalOpen(false);
  };
  const handleClearProductFilters = () => {
    setProductSearchQuery('');
    setSelectedCategory('all');
    setMinPriceProduct('');
    setMaxPriceProduct('');
    setIsBestSellerFilterProduct(false);
    setIsPromoFilterProduct(false);
    setIsForeignFilterProduct(false);
    setIsPriceFilterAppliedProduct(false);
    setIsProductFilterModalOpen(false);
  };

  // --- Collection Filter Modal Handlers ---
  const handleOpenCollectionFilterModal = () =>
    setIsCollectionFilterModalOpen(true);
  const handleCloseCollectionFilterModal = () =>
    setIsCollectionFilterModalOpen(false);
  const handleApplyCollectionFilters = () => {
    setIsCollectionFilterModalOpen(false);
  };
  const handleClearCollectionFilters = () => {
    setCollectionSearchQuery('');
    setMinPriceCollection('');
    setMaxPriceCollection('');
    setIsBestSellerFilterCollection(false);
    setIsPromoFilterCollection(false);
    setIsForeignFilterCollection(false);
    setIsPriceFilterAppliedCollection(false);
    setIsCollectionFilterModalOpen(false);
  };

  // --- Navigation & Cart/Wishlist Handlers ---
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

  const handleAddToCart = (id, quantity, type) => {
    addToCart(id, quantity, type);
  };

  const isInWishlist = (id) =>
    (wishlist || []).some((wishlistItem) => wishlistItem.item === id);

  const handleAddToWishlist = (id, type) => {
    addToWishlist(id, type);
  };

  const handleRemovefromWishlist = (id, type) => {
    removeFromWishlist(id, type);
  };

  // Helper for WhatsApp link
  const whatsappPhoneNumber = '2349037691860';
  const whatsappHref = (item) => {
    const itemName = item.name || 'item';
    const itemPrice =
      item.isPromo && item.discountedPrice !== undefined
        ? Number(item.discountedPrice).toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : Number(item.price).toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    const message = encodeURIComponent(
      `Hello, I'm interested in "${itemName}" (Price: ₦${itemPrice}). I saw it on your website and would like to inquire more.`
    );
    return `https://wa.me/${whatsappPhoneNumber}?text=${message}`;
  };

  // Combined loading state for initial full page load
  if (
    !isAuthReady ||
    (isGettingProducts && products.length === 0) ||
    (isGettingCollections && collections.length === 0)
  ) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading styles data...</p>
      </div>
    );
  }

  return (
    <div className="">
      <div className="relative">
        <img src={Hero1} alt="Shop Hero" className="object-cover h-50 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-15 left-1/2 -translate-x-1/2 mt-20 mb-2 text-4xl font-bold text-center text-base-100 font-[poppins]">
            {style
              ? style.charAt(0).toUpperCase() +
                style.slice(1).replace(/%2F/g, '/')
              : ''}
          </h1>

          {/* Filters Section: Category and Style Dropdown */}
          <div className="absolute bottom-1 flex flex-col justify-center items-center gap-4 w-full">
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
                  <div className="absolute z-101 w-full bg-base-100 border border-base-300 rounded-md shadow-lg mt-1 top-full max-h-80 overflow-y-auto">
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

          {/** Styles Selector */}
          <div className="absolute bottom-8 flex flex-col justify-center items-center gap-4 w-full">
            {
              <div
                className="form-control relative w-full max-w-xs"
                ref={StyledropdownRef}
              >
                <div
                  className="input border-0 w-full bg-transparent rounded-md flex items-center justify-center cursor-pointer shadow-none"
                  onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsStyleDropdownOpen(!isStyleDropdownOpen);
                    }
                  }}
                >
                  <span className="font-[montserrat] text-base-100 font-bold">
                    {style
                      ? style.charAt(0).toUpperCase() + style.slice(1)
                      : ''}
                  </span>
                  {isStyleDropdownOpen ? (
                    <ChevronUp className="stroke-base-100" />
                  ) : (
                    <ChevronDown className="stroke-base-100" />
                  )}
                </div>

                {isStyleDropdownOpen && (
                  <div className="absolute z-101 w-full bg-base-100 border border-base-300 rounded-md shadow-lg mt-1 top-full max-h-80 overflow-y-auto">
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
                          value={styleSearchQuery}
                          onChange={(e) => setStyleSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    {
                      <ul className="menu p-0 w-full">
                        {designs.map((category) => (
                          <li key={category.id}>
                            <button
                              onClick={() => handleStyleChange(category.link)}
                              className={`font-[montserrat] btn border-0 shadow-0 bg-base-100 w-full text-left p-2 hover:bg-base-200 rounded-none
        ${selectedCategory?.id === category.id ? 'font-bold bg-base-200' : ''}`}
                            >
                              {category.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    }
                  </div>
                )}
              </div>
            }
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        {/* Products/Collections Switch */}
        <div className="flex justify-center my-5">
          <div className="tabs tabs-boxed space-x-4">
            <button
              type="button"
              className={`btn tab rounded-xl ${
                viewMode === 'products' ? 'tab-active bg-primary' : ''
              }`}
              onClick={() => setViewMode('products')}
            >
              Products
            </button>
            <button
              type="button"
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
                  />
                </div>
              </div>
              {/* "More Filters" Button for Products */}
              <div className="form-control w-full sm:ml-2 sm:mt-0 mt-2 sm:w-auto">
                <button
                  type="button"
                  className="btn text-secondary btn-primary rounded-xl w-full"
                  onClick={handleOpenProductFilterModal}
                >
                  <Filter size={20} /> Filters
                </button>
              </div>
            </div>

            {/* Product Grid */}
            {isGettingProducts && products.length === 0 ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-2 text-lg">Loading products...</p>
              </div>
            ) : products.length === 0 && !isGettingProducts ? (
              <div className="text-center text-xl text-gray-600 my-16">
                No products found for the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <div
                    key={product._id}
                    className=" rounded-xl overflow-hidden"
                  >
                    <figure className="relative h-60 w-full overflow-hidden rounded-xl">
                      <button
                        type="button"
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

                      {!isAdmin ? (
                        isInWishlist(product._id) ? (
                          <button
                            type="button"
                            className="absolute top-3 right-3"
                            aria-label="Remove from wishlist"
                            onClick={() =>
                              handleRemovefromWishlist(product._id, 'Product')
                            }
                          >
                            {isRemovingFromWishlist ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Heart className="text-primary size-7 fill-primary" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="absolute top-3 right-3"
                            aria-label="Add to wishlist"
                            onClick={() =>
                              handleAddToWishlist(product._id, 'Product')
                            }
                          >
                            {isAddingToWishlist ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Heart className="text-primary size-7" />
                            )}
                          </button>
                        )
                      ) : null}
                      <span className="absolute bottom-3 left-3 text-base text-shadow-lg truncate text-base-100 font-[montserrat]">
                        {product.style}{' '}
                        {product.collectionId && product.collectionId.name && (
                          <span className="text-sm mb-1">
                            | {product.collectionId.name}
                          </span>
                        )}
                      </span>
                    </figure>

                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text max-w-50 font whitespace-nowrap truncate">
                            {product.name}
                          </h2>
                          {product.isPromo &&
                          product.discountedPrice !== undefined ? (
                            <div className="flex flex-col">
                              <span className="text-red-600 font-bold text-lg">
                                ₦
                                {Number(product.discountedPrice).toLocaleString(
                                  'en-NG',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                              <span className="text-gray-500 line-through text-sm">
                                ₦
                                {Number(product.price).toLocaleString('en-NG', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="font-semibold text-lg">
                              ₦
                              {Number(product.price).toLocaleString('en-NG', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          )}
                        </div>
                        {!isAdmin ? (
                          <div className="space-x-1">
                            <a
                              href={whatsappHref(product)}
                              className="btn rounded-xl bg-green-400"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={whatsapp}
                                alt="WhatsApp"
                                className="size-5"
                              />
                            </a>
                            <button
                              type="button"
                              className="btn rounded-xl bg-primary"
                              onClick={() =>
                                handleAddToCart(product._id, 1, 'Product')
                              }
                              disabled={isAddingToCart}
                            >
                              {isAddingToCart ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <ShoppingCart className="" />
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            

            {hasMoreProducts && !isGettingProducts && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={handleLoadMoreProducts}
                  className="mb-4 btn bg-primary px-8 py-3 rounded-xl font-semibold"
                >
                  {!isGettingProducts ? (
                    'Load More'
                  ) : (
                    <Loader2 className="animate-spin" />
                  )}
                </button>
              </div>
            )}

            {!hasMoreProducts && products.length > 0 && !isGettingProducts && (
              <p className="text-center text-gray-600 my-8">
                You've reached the end of the products!
              </p>
            )}

            {/* Product Filter Modal */}
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
              isForeignFilter={isForeignFilterProduct}
              setIsForeignFilter={setIsForeignFilterProduct}
              setIsPriceFilterApplied={setIsPriceFilterAppliedProduct}
              onApplyFilters={handleApplyProductFilters}
              onClearFilters={handleClearProductFilters}
            />
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
                  type="button"
                  className="btn text-secondary btn-primary rounded-xl w-full"
                  onClick={handleOpenCollectionFilterModal}
                >
                  <Filter size={20} /> Filters
                </button>
              </div>
            </div>

            {/* Collection List */}
            {isGettingCollections && collections.length === 0 ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-2 text-lg">Loading collections...</p>
              </div>
            ) : collections.length === 0 && !isGettingCollections ? (
              <div className="text-center text-xl text-gray-600 my-16">
                No collections found for the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {collections.map((collection) => (
                  <div
                    key={collection._id}
                    className="rounded-xl overflow-hidden"
                  >
                    <figure className="relative h-60 w-full overflow-hidden rounded-xl">
                      <button
                        type="button"
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
                      {!isAdmin ? (
                        isInWishlist(collection._id) ? (
                          <button
                            type="button"
                            className="absolute top-3 right-3"
                            aria-label="remove from wishlist"
                            onClick={() =>
                              handleRemovefromWishlist(
                                collection._id,
                                'Collection'
                              )
                            }
                          >
                            {isRemovingFromWishlist ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Heart className="text-primary size-7 fill-primary" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="absolute top-3 right-3"
                            aria-label="Add to wishlist"
                            onClick={() =>
                              handleAddToWishlist(collection._id, 'Collection')
                            }
                          >
                            {isAddingToWishlist ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Heart className="text-primary size-7" />
                            )}
                          </button>
                        )
                      ) : null}
                      <span className="absolute bottom-3 left-3 text-base text-shadow-lg truncate text-base-100 font-[montserrat]">
                        {collection.style}
                      </span>
                    </figure>
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text max-w-50 font whitespace-nowrap truncate">
                            {collection.name}
                          </h2>
                          {collection.isPromo &&
                          collection.discountedPrice !== undefined ? (
                            <div className="flex flex-col">
                              <span className="text-red-600 font-bold text-lg">
                                ₦
                                {Number(
                                  collection.discountedPrice
                                ).toLocaleString('en-NG', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <span className="text-gray-500 line-through text-sm">
                                ₦
                                {Number(collection.price).toLocaleString(
                                  'en-NG',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="font-semibold text-lg">
                              ₦
                              {Number(collection.price).toLocaleString(
                                'en-NG',
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          )}
                        </div>
                        {!isAdmin ? (
                          <div className="space-x-1">
                            <a
                              href={whatsappHref(collection)}
                              className="btn rounded-xl bg-green-400"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={whatsapp}
                                alt="WhatsApp"
                                className="size-5"
                              />
                            </a>
                            <button
                              type="button"
                              className="btn rounded-xl bg-primary"
                              onClick={() =>
                                handleAddToCart(collection._id, 1, 'Collection')
                              }
                              disabled={isAddingToCart}
                            >
                              {isAddingToCart ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <ShoppingCart className="" />
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* {isGettingCollections && collections.length > 0 && (
              <div className="flex justify-center items-center mt-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-lg">Loading more collections...</p>
              </div>
            )} */}

            {hasMoreCollections && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={handleLoadMoreCollections}
                  className="mb-4 btn bg-primary px-8 py-3 rounded-xl font-semibold"
                >
                  {!isGettingCollections ? (
                    'Load More'
                  ) : (
                    <Loader2 className="animate-spin" />
                  )}
                </button>
              </div>
            )}

            {!hasMoreCollections &&
              collections.length > 0 &&
              !isGettingCollections && (
                <p className="text-center text-gray-600 my-8">
                  You've reached the end of the collections!
                </p>
              )}

            {/* Collection Filter Modal */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default Styles;
