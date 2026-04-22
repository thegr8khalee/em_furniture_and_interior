// src/pages/ProductPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

void motion;

import {
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Heart,
  Loader2,
  Pen,
  Share2,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { luxuryEase } from '../lib/animations';
import { FadeIn, PageWrapper, SectionReveal, SlideIn } from '../components/animations';
import { Badge, Button, Card, EmptyState, Select, Textarea } from '../components/ui';
import { useProductsStore } from '../store/useProductsStore';
// import whatsapp from '../images/whatsapp.png';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useCompareStore } from '../store/useCompareStore';
import { useMarketingStore } from '../store/useMarketingStore';
import { axiosInstance } from '../lib/axios.js';
import SEO from '../components/SEO';
import {
  productJsonLd,
  breadcrumbJsonLd,
  truncate,
} from '../lib/seo';

const LOCAL_STORAGE_RECENT_KEY = 'recentlyViewedProducts';
const SESSION_STORAGE_RECENT_KEY = 'recentlyViewedProductsSession';

const getConsentStatus = () => {
  const consentValue = localStorage.getItem('cookie_consent_accepted');
  return {
    hasResponded: consentValue !== null,
    isAccepted: consentValue === 'true',
  };
};

const getStoredRecentIds = () => {
  try {
    const { isAccepted } = getConsentStatus();
    if (isAccepted) {
      const stored = localStorage.getItem(LOCAL_STORAGE_RECENT_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    const sessionStored = sessionStorage.getItem(SESSION_STORAGE_RECENT_KEY);
    return sessionStored ? JSON.parse(sessionStored) : [];
  } catch (error) {
    console.error('Error reading recently viewed ids:', error);
    return [];
  }
};

const saveRecentIds = (ids) => {
  try {
    const { isAccepted } = getConsentStatus();
    if (isAccepted) {
      localStorage.setItem(LOCAL_STORAGE_RECENT_KEY, JSON.stringify(ids));
      sessionStorage.removeItem(SESSION_STORAGE_RECENT_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_RECENT_KEY, JSON.stringify(ids));
      localStorage.removeItem(LOCAL_STORAGE_RECENT_KEY);
    }
  } catch (error) {
    console.error('Error saving recently viewed ids:', error);
  }
};
const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const {
    product,
    getProductById,
    isGettingProducts,
    getProductsByIds,
  } = useProductsStore();
  const { addToCart, isAddingToCart } = useCartStore();
  const {
    addToWishlist,
    isAddingTowishlist,
    wishlist,
    getwishlist,
    removeFromwishlist,
    isRemovingFromwishlist,
  } = useWishlistStore();

  const { isAdmin, authUser } = useAuthStore();

  const { isDeletingProduct, delProduct } = useAdminStore();
  const { compareIds, toggleCompare, clearCompare } = useCompareStore();
  const { banners, getActiveBanners } = useMarketingStore();

  const [recentIds, setRecentIds] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleEditProduct = (product) => {
    // console.log(product);
    navigate(`/admin/products/edit/${product}`);
  };

  const handleDeleteProduct = async (productId) => {
    // NEW: Add a confirmation prompt before deleting
    if (
      window.confirm(
        'Are you sure you want to delete this product? This action cannot be undone.'
      )
    ) {
      delProduct(productId);
      navigate(-1);
      // User cancelled the deletion
      // toast.info('Product deletion cancelled.'); // Optional: inform user
    }
  };

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // NEW: Refs for touch events
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const minSwipeDistance = 50; // Minimum distance for a recognized swipe

  // Fetch product details when component mounts or productId changes
  useEffect(() => {
    if (productId) {
      getProductById(productId);
    }
    if (!isAdmin) {
      getwishlist();
    }
    getActiveBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, getProductById, getwishlist, getActiveBanners]);

  // Reset currentImageIndex when product changes (e.g., navigating to a new product page)
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product]);

  useEffect(() => {
    setReviews(product?.reviews || []);
  }, [product]);

  useEffect(() => {
    if (!product || !product._id) return;

    const existingIds = getStoredRecentIds();
    const nextIds = [
      product._id,
      ...existingIds.filter((id) => id !== product._id),
    ].slice(0, 8);

    saveRecentIds(nextIds);
    setRecentIds(nextIds.filter((id) => id !== product._id));
  }, [product]);

  useEffect(() => {
    let isMounted = true;

    const loadRecentProducts = async () => {
      if (recentIds.length === 0) {
        if (isMounted) setRecentProducts([]);
        return;
      }

      const items = await getProductsByIds(recentIds);
      if (isMounted) setRecentProducts(items);
    };

    loadRecentProducts();

    return () => {
      isMounted = false;
    };
  }, [recentIds, getProductsByIds]);

  // Handle image navigation
  const nextImage = () => {
    if (product && product.images && product.images.length > 1) {
      setCurrentImageIndex(
        (prevIndex) => (prevIndex + 1) % product.images.length
      );
    }
  };

  const prevImage = () => {
    if (product && product.images && product.images.length > 1) {
      setCurrentImageIndex(
        (prevIndex) =>
          (prevIndex - 1 + product.images.length) % product.images.length
      );
    }
  };

  // NEW: Touch event handlers for image sliding
  const onTouchStart = (e) => {
    touchEndX.current = 0; // Reset end touch on new start
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return; // Ensure touch points exist

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextImage();
    } else if (isRightSwipe) {
      prevImage();
    }

    // Reset touch points
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Placeholder functions for cart and wishlist
  const handleAddToCart = (id, quantity, type) => {
    addToCart(id, quantity, type);
  };

  // console.log(wishlist);
  const handleAddToWishlist = (id, type) => {
    addToWishlist(id, type);
  };

  const handleRemovefromWishlist = (id, type) => {
    removeFromwishlist(id, type);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!authUser) {
      navigate('/login');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await axiosInstance.post(`/review/products/${productId}`, {
        rating: reviewRating,
        comment: reviewComment,
      });

      setReviews((prev) => [res.data.review, ...prev]);
      setReviewComment('');
      setReviewRating(5);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isInWishlist = (wishlist || []).some(
    (wishlistItem) =>
      wishlistItem.item === productId && wishlistItem.itemType === 'Product'
  );

  const whatsappNumber = '2349037691860'; // Your actual WhatsApp number

  // Construct the base product URL dynamically using window.location.origin
  // This will correctly resolve to http://localhost:5173 or your actual deployed domain
  const productLink = (id) => `${window.location.origin}/product/${id}`;

  // Construct the full message, ensuring it's fully URL-encoded
  const fullMessage = (product) =>
    encodeURIComponent(
      `I want to Order this: ${product.name}.\n` + // Use \n for new lines in WhatsApp
        `Price: N${
          product?.discountedPrice?.toFixed(2) || product.price?.toFixed(2)
        }.\n` +
        `Link: ${productLink(product._id)}`
    );

  const whatsappHref = (product) =>
    `https://wa.me/${whatsappNumber}?text=${fullMessage(product)}`;

  const isInCompare = (compareIds || []).includes(productId);

  const formatDeliveryDate = (date) =>
    new Intl.DateTimeFormat('en-NG', {
      month: 'short',
      day: 'numeric',
    }).format(date);

  const getEstimatedDelivery = (item) => {
    if (!item) return null;
    const hasEstimateData =
      item.leadTimeDays !== undefined ||
      item.shippingMinDays !== undefined ||
      item.shippingMaxDays !== undefined;
    if (!hasEstimateData) return null;

    const leadTime = Number(item.leadTimeDays || 0);
    const shipMin =
      item.shippingMinDays !== undefined
        ? Number(item.shippingMinDays)
        : 0;
    const shipMax =
      item.shippingMaxDays !== undefined
        ? Number(item.shippingMaxDays)
        : shipMin;

    if (Number.isNaN(leadTime) || Number.isNaN(shipMin) || Number.isNaN(shipMax)) {
      return null;
    }

    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + leadTime + shipMin);

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + leadTime + shipMax);

    if (leadTime + shipMin === leadTime + shipMax) {
      return formatDeliveryDate(minDate);
    }

    return `${formatDeliveryDate(minDate)} - ${formatDeliveryDate(maxDate)}`;
  };

  const estimatedDelivery = getEstimatedDelivery(product);

  // Loading state
  if (isGettingProducts) {
    return (
      <PageWrapper className="min-h-screen bg-white">
        <div className="content-shell section-shell flex min-h-screen items-center justify-center px-4">
          <Card className="surface-elevated max-w-lg text-center" padding="px-8 py-10">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-secondary" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Loading product details
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-primary">
              Preparing the showroom view
            </h2>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  // Error state (e.g., product not found, network error)
  // if (productsError) {
  //     return (
  //         <div role="alert" className="alert alert-error my-8 mx-auto w-full max-w-lg">
  //             <span>Error: {productsError}</span>
  //             <button onClick={() => navigate('/shop')} className="btn btn-sm btn-primary ml-4">Back to Shop</button>
  //         </div>
  //     );
  // }

  // If product is null (e.g., ID not found after loading)
  if (!product && !isGettingProducts) {
    return (
      <PageWrapper className="min-h-screen bg-base-100">
        <div className="content-shell section-shell flex min-h-screen items-center justify-center px-4">
          <EmptyState
            icon={ShoppingCart}
            title="Product not found"
            description="This piece may have been moved, removed, or is temporarily unavailable."
            actionLabel="Back to Shop"
            onAction={() => navigate('/shop')}
            className="max-w-xl"
          />
        </div>
      </PageWrapper>
    );
  }

  // Main Product Display
  const productImage = product?.images?.[0]?.url;
  const productSeoTitle = product?.seoTitle || product?.name;
  const productSeoDescription =
    product?.seoDescription ||
    truncate(product?.description || product?.name || '', 160);
  const productSeoKeywords =
    product?.seoKeywords?.join(', ') ||
    [product?.name, product?.category, product?.style, 'EM Furniture']
      .filter(Boolean)
      .join(', ');
  let customProductSchema = null;
  if (product?.seoSchemaJsonLd) {
    try {
      customProductSchema = JSON.parse(product.seoSchemaJsonLd);
    } catch {
      customProductSchema = null;
    }
  }

  return (
    <PageWrapper>
    <SEO
      title={productSeoTitle}
      description={productSeoDescription}
      keywords={productSeoKeywords}
      image={productImage}
      imageAlt={product?.name}
      type="product"
      canonical={`/product/${product?._id}`}
      jsonLd={[
        customProductSchema || productJsonLd(product),
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
          ...(product?.category
            ? [
                {
                  name: product.category,
                  path: `/shop?category=${encodeURIComponent(product.category)}`,
                },
              ]
            : []),
          { name: product?.name || 'Product', path: `/product/${product?._id}` },
        ]),
      ]}
    />
    <div className="min-h-screen bg-white pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between mb-4">
          <Button
            onClick={() => {
              navigate(-1);
              setTimeout(() => {
                window.scrollTo(0, 0);
              }, 10);
            }}
            variant="icon"
            size="icon"
            ariaLabel="Go back"
          >
            <ChevronLeft size={20} />
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard!');
            }}
            variant="icon"
            size="icon"
            ariaLabel="Copy product link"
          >
            <Share2 size={20} />
          </Button>
        </div>

      <div className="flex flex-col md:flex-row gap-8 px-4 sm:px-0">
        {/* Product Image Gallery */}
        <motion.div
          className="md:w-1/2 flex flex-col items-center"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: luxuryEase }}
        >
          <div
            className="relative w-full aspect-video sm:aspect-[4/3] max-h-[500px] bg-base-200 rounded-none overflow-hidden flex items-center justify-center"
            onTouchStart={onTouchStart} // NEW: Touch event for main image
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {product.images && product.images.length > 0 ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImageIndex}
                    src={product.images[currentImageIndex].url}
                    alt={product.name}
                    className="w-full h-full rounded-none"
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.5, ease: luxuryEase }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        'https://placehold.co/600x400/E0E0E0/333333?text=Image+Error';
                    }}
                  />
                </AnimatePresence>
                {product.images.length > 1 && (
                  <>
                    <Button
                      onClick={prevImage}
                      className="absolute left-2 border-0 bg-black/55 text-white hover:bg-black/75 hover:text-white"
                      variant="icon"
                      size="icon"
                      ariaLabel="Previous image"
                    >
                      <ChevronLeft size={24} />
                    </Button>
                    <Button
                      onClick={nextImage}
                      className="absolute right-2 border-0 bg-black/55 text-white hover:bg-black/75 hover:text-white"
                      variant="icon"
                      size="icon"
                      ariaLabel="Next image"
                    >
                      <ChevronRight size={24} />
                    </Button>
                    {product.isBestSeller && (
                      <Badge className="absolute left-3 top-3" variant="secondary">
                        Best Seller
                      </Badge>
                    )}
                  </>
                )}
              </>
            ) : (
              <img
                src="https://placehold.co/600x400/E0E0E0/333333?text=No+Image"
                alt="No Image Available"
                className="w-full h-full object-contain rounded-none"
              />
            )}
          </div>

          {/* NEW: Image Previews (Thumbnails) */}
          {product.images && product.images.length > 0 && (
            <div className="hidden mt-4 md:flex flex-wrap justify-center gap-2">
              {product.images.map((image, index) => (
                <img
                  key={image.public_id || index} // Use public_id if available, otherwise index
                  src={image.url}
                  alt={`Thumbnail ${index + 1}`}
                  className={`w-20 h-20 object-cover rounded-none cursor-pointer border-2 transition-all duration-200
                                        ${
                                          index === currentImageIndex
                                            ? 'border-primary shadow-md'
                                            : 'border-transparent hover:border-gray-300'
                                        }`}
                  onClick={() => setCurrentImageIndex(index)}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      'https://placehold.co/80x80/E0E0E0/333333?text=Err';
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Product Details */}
        <motion.div
          className="md:w-1/2 space-y-1"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: luxuryEase }}
        >
          <div className="flex flex-wrap space-x-2 font-normal text-neutral/50 items-center text-xs sm:text-sm uppercase tracking-wider">
            <p>{product.style}</p>
            <p>| {product.category}</p>
            {product.isForeign && product.origin && (
              <span>| Made in {product.origin}</span>
            )}
            {product.collectionId && product.collectionId.name && (
              <p>| {product.collectionId.name} collection</p>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-neutral">{product.name}</h1>
          <p>{product.items}</p>
          <div className="text-base font-body text-neutral/70"></div>
          <div className="flex items-baseline space-x-3">
            {product.isPromo && product.discountedPrice !== undefined ? (
              <>
                <span className="text-secondary font-bold text-xl">
                  ₦
                  {Number(product.discountedPrice).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-neutral/60 line-through text">
                  ₦
                  {Number(product.price).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-green-600 text font-semibold">
                  (
                  {(
                    ((product.price - product.discountedPrice) /
                      product.price) *
                    100
                  ).toFixed(0)}
                  % OFF)
                </span>
              </>
            ) : (
              <span className="text-secondary font-bold text-xl">
                ₦
                {Number(product.price).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>{' '}
          <p className="text-sm text-neutral/60">
            Estimated delivery:{' '}
            {estimatedDelivery || 'Contact us for timing.'}
          </p>
          {/* <p
            className="text text-gray-700 font-body"
            dangerouslySetInnerHTML={{ __html: product.description }}
          ></p> */}
          {!isAdmin ? (
            <Button
              href={whatsappHref(product)}
              className="my-4 w-full border-0 bg-green-600 font-heading text-white hover:bg-green-700 hover:text-white"
            >
              Order Now
            </Button>
          ) : null}
          {isAdmin ? (
            <div className="space-y-2">
              <Button className="mr-2 w-full" onClick={() => handleEditProduct(productId)} leftIcon={Pen}>
                Edit Product
              </Button>
              <Button
                variant="danger"
                className="w-full"
                onClick={() => handleDeleteProduct(product._id)}
                isLoading={isDeletingProduct}
                leftIcon={Trash2}
              >
                Delete Product
              </Button>
            </div>
          ) : null}
          {!isAdmin ? (
            <div className="flex flex-col space-y-4 mb-6">
              <Button
                className="flex-1 border-0 shadow-none"
                onClick={() => handleAddToCart(product._id, 1, 'Product')}
                isLoading={isAddingToCart}
                leftIcon={ShoppingCart}
              >
                Add to Cart
              </Button>
              <Button
                className={`flex-1 shadow-none ${
                  isInCompare ? 'bg-neutral text-white hover:bg-neutral/90 hover:text-white' : 'bg-base-300 text-neutral hover:bg-base-300/80'
                }`}
                variant="ghost"
                onClick={() => toggleCompare(product._id)}
                leftIcon={GitCompare}
              >
                Compare
              </Button>
              {isInWishlist ? (
                <Button
                  variant="primary"
                  className="flex-1 shadow-none"
                  onClick={() => handleRemovefromWishlist(productId, 'Product')}
                  isLoading={isRemovingFromwishlist}
                  leftIcon={Heart}
                >
                  Saved
                </Button>
              ) : (
                <Button
                  variant="elegant-outline"
                  className="flex-1 shadow-none"
                  onClick={() => handleAddToWishlist(product._id, 'Product')}
                  isLoading={isAddingTowishlist}
                  leftIcon={Heart}
                >
                  Wishlist
                </Button>
              )}
            </div>
          ) : null}
          {compareIds.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <Button type="button" variant="primary" size="sm" onClick={() => navigate('/compare')}>
                View compare ({compareIds.length})
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearCompare}>
                Clear compare
              </Button>
            </div>
          )}
          <p
            className="text text-neutral/60"
            dangerouslySetInnerHTML={{ __html: product.description }}
          ></p>
        </motion.div>
      </div>

      {!isAdmin && (
        <SectionReveal className="mt-12">
          <motion.h2
            className="font-heading text-xl font-semibold text-neutral mb-4"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: luxuryEase }}
          >
            Reviews
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="p-4">
              <p className="mb-2 text-sm text-neutral/60">
                Average rating: {product.averageRating || 0} / 5
              </p>
              {authUser ? (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <Select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    label="Rating"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    rows="3"
                    label="Comment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <Button type="submit" variant="primary" isLoading={isSubmittingReview}>
                    Submit Review
                  </Button>
                </form>
              ) : (
                <Button type="button" variant="elegant-outline" onClick={() => navigate('/login')}>
                  Login to review
                </Button>
              )}
            </Card>

            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-neutral/60">No reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <Card key={review._id} padding="p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {review.userId?.username || 'Customer'}
                      </div>
                      <div className="text-xs text-neutral/60">
                        {review.rating} / 5
                      </div>
                    </div>
                    {review.isVerifiedPurchase && (
                      <div className="text-xs text-green-600 mt-1">Verified purchase</div>
                    )}
                    {!review.isApproved && (
                      <div className="text-xs text-amber-600 mt-1">Pending approval</div>
                    )}
                    {review.comment && (
                      <p className="text-sm text-neutral/70 mt-2">{review.comment}</p>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </SectionReveal>
      )}

      {recentProducts.length > 0 && (
        <SectionReveal className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <motion.h2
              className="font-heading text-xl font-semibold text-neutral"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: luxuryEase }}
            >
              Recently viewed
            </motion.h2>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => navigate('/shop')}
            >
              Browse more
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentProducts.map((item, index) => (
              <motion.button
                key={item._id}
                type="button"
                className="text-left border border-base-300 p-3 hover:shadow-md transition"
                onClick={() => navigate(`/product/${item._id}`)}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.1, ease: luxuryEase }}
                whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}
              >
                <img
                  src={item.images?.[0]?.url}
                  alt={item.name}
                  className="w-full h-32 object-cover mb-3"
                />
                <div className="text-sm font-semibold text-neutral truncate">
                  {item.name}
                </div>
                <div className="text-sm text-neutral/60">
                  {item.isPromo && item.discountedPrice !== undefined
                    ? `NGN ${Number(item.discountedPrice).toLocaleString('en-NG')}`
                    : item.price !== undefined
                    ? `NGN ${Number(item.price).toLocaleString('en-NG')}`
                    : 'Price on request'}
                </div>
              </motion.button>
            ))}
          </div>
        </SectionReveal>
      )}
      {/* ===== Product Banners ===== */}
      {banners.filter((b) => b.position === 'product').length > 0 && (
        <SectionReveal className="py-8 px-6 sm:px-10 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {banners
              .filter((b) => b.position === 'product')
              .sort((a, b) => (b.priority || 0) - (a.priority || 0))
              .map((banner) => (
                <a
                  key={banner._id}
                  href={banner.linkUrl || '#'}
                  className="relative block rounded-lg overflow-hidden group"
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-36 sm:h-44 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-heading text-base font-medium">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-white/80 text-xs mt-0.5">{banner.subtitle}</p>
                    )}
                  </div>
                </a>
              ))}
          </div>
        </SectionReveal>
      )}
    </div>
    </div>
    </PageWrapper>
  );
};

export default ProductPage;
