// src/pages/CollectionDetailsPage.jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper, SectionReveal, SlideIn } from '../components/animations';
import {
  Loader2,
  ShoppingCart,
  Heart,
  ChevronLeft,
  Share,
  Share2,
  Pen,
  Trash2,
} from 'lucide-react';
// import { useAdminStore } from '../store/useAdminStore'; // To get collection details
import { useProductsStore } from '../store/useProductsStore'; // To get all products and filter them
import { useCollectionStore } from '../store/useCollectionStore';
// import whatsapp from '../images/whatsapp.png';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
// import { useAdminStore } from '../store/useAdminStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useMarketingStore } from '../store/useMarketingStore';
import { axiosInstance } from '../lib/axios.js';
import SEO from '../components/SEO';
import {
  collectionJsonLd,
  breadcrumbJsonLd,
  truncate,
} from '../lib/seo';

const CollectionDetailsPage = () => {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  const { collection, getCollectionById, isGettingCollections } =
    useCollectionStore();
  const { addToCart, isAddingToCart } = useCartStore();
  const {
    addToWishlist,
    isAddingTowishlist,
    wishlist,
    getwishlist,
    removeFromwishlist,
    isRemovingFromwishlist,
  } = useWishlistStore();

  const {
    products, // All products to filter by collectionId
    getProducts, // Ensure products are fetched
    isGettingProducts,
  } = useProductsStore();

  const { isAdmin, authUser } = useAuthStore();

  const { delCollection, isDeletingCollection } = useAdminStore();
  const { banners, getActiveBanners } = useMarketingStore();

  const [reviews, setReviews] = React.useState([]);
  const [reviewRating, setReviewRating] = React.useState(5);
  const [reviewComment, setReviewComment] = React.useState('');
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);

  // Fetch collection details when component mounts or collectionId changes
  useEffect(() => {
    if (collectionId) {
      getCollectionById(collectionId);
    }
    // Ensure all products are fetched to filter them later
    getProducts();
    if (!isAdmin) {
      getwishlist();
    }
    getActiveBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, getCollectionById, getProducts, getwishlist, getActiveBanners]);

  useEffect(() => {
    setReviews(collection?.reviews || []);
  }, [collection]);

  //   console.log(collection)

  // Filter products that belong to this collection
  const productsInCollection = products.filter(
    (p) => p.collectionId?._id === collectionId
  );

  // Placeholder functions for cart and wishlist (reusing from ProductPage)
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
      const res = await axiosInstance.post(`/review/collections/${collectionId}`, {
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

  const handleProductClick = (Id) => {
    navigate(`/product/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleEditCollection = async (collection) => {
    navigate(`/admin/collections/edit/${collection}`);
  };

  const handleDeleteCollection = async (collectionId) => {
    if (
      window.confirm(
        'Are you sure you want to delete this collection? This action cannot be undone.'
      )
    ) {
      await delCollection(collectionId);
      navigate(-1);
    }
  };

  const isInWishlist = (id) =>
    (wishlist || []).some((wishlistItem) => wishlistItem.item === id);

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

  // Combined loading state
  if (isGettingCollections || isGettingProducts) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading collection details...</p>
      </div>
    );
  }

  // Error state for collection fetch
  //   if (adminError) {
  //     return (
  //       <div
  //         role="alert"
  //         className="alert alert-error my-8 mx-auto w-full max-w-lg"
  //       >
  //         <span>Error: {adminError}</span>
  //         <button
  //           onClick={() => navigate('/shop?view=collections')}
  //           className="btn btn-sm btn-primary ml-4"
  //         >
  //           Back to Collections
  //         </button>
  //       </div>
  //     );
  //   }

  // If collection is null (e.g., ID not found after loading)
  if (!collection) {
    return (
      <div className="text-center text-xl text-neutral/70 mt-16">
        Collection not found.
        <button
          onClick={() => navigate('/shop?view=collections')}
          className="btn btn-sm btn-primary ml-4"
        >
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <PageWrapper>
    <SEO
      title={collection?.name ? `${collection.name} Collection` : 'Collection'}
      description={truncate(
        collection?.description ||
          `Explore the ${collection?.name || ''} collection — curated luxury furniture from EM Furniture & Interior.`,
        160,
      )}
      image={collection?.coverImage?.url}
      imageAlt={collection?.name}
      type="product"
      canonical={`/collection/${collection?._id}`}
      jsonLd={[
        collectionJsonLd(collection),
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
          { name: 'Collections', path: '/shop?view=collections' },
          {
            name: collection?.name || 'Collection',
            path: `/collection/${collection?._id}`,
          },
        ]),
      ]}
    />
    <div className="min-h-screen bg-white pt-16 pb-12">
      <div className="w-full flex justify-between">
        <button
          onClick={() => {
            navigate(-1);
            setTimeout(() => {
              window.scrollTo(0, 0);
            }, 10);
          }}
          className="btn btn-circle btn-ghost border border-base-300 hover:bg-base-200 mx-4 mt-2"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
          }}
          className="btn btn-circle btn-ghost border border-base-300 hover:bg-base-200 mx-4 mt-2"
        >
          <Share2 size={20} />
        </button>
      </div>
      {/* Collection Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <motion.figure
            className="w-full md:w-1/2 aspect-video sm:aspect-[4/3] max-h-[400px] overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: luxuryEase }}
          >
            <img
              src={
                collection.coverImage?.url ||
                'https://placehold.co/600x400/E0E0E0/333333?text=No+Cover'
              }
              alt={collection.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  'https://placehold.co/600x400/E0E0E0/333333?text=Image+Error';
              }}
            />
          </motion.figure>
          <motion.div
            className="w-full"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: luxuryEase }}
          >
            <div className="md:w-full space-y-1 md:text-left">
              <div className="flex space-x-2 text-neutral/50 text-xs tracking-widest uppercase font-medium mb-2">
                <p>{collection.style}</p>
                {collection.isForeign && collection.origin && (
                  <span>| Made in {collection.origin}</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-heading font-semibold text-neutral mb-4">
                {collection.name}
              </h1>
              <p>{collection.items}</p>
              <div className="flex space-x-3">
                {collection.isPromo &&
                collection.discountedPrice !== undefined ? (
                  <>
                    <span className="text-xl font-body font-bold text-secondary">
                      ₦
                      {Number(collection.discountedPrice).toLocaleString(
                        'en-NG',
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </span>
                    <span className="text-neutral/40 line-through text-sm">
                      ₦
                      {Number(collection.price).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-accent text-sm font-medium ml-2">
                      (
                      {(
                        ((collection.price - collection.discountedPrice) /
                          collection.price) *
                        100
                      ).toFixed(0)}
                      % OFF)
                    </span>
                  </>
                ) : (
                  <span className="text-xl font-body font-bold text-secondary">
                    ₦
                    {Number(collection.price).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </div>
              {/* <p className="text text-gray-700 font-body">
                {collection.description}
              </p> */}
              {/* <button
                className="my-4 btn bg-green-500 text-base-100 w-full rounded-none font-heading shadow-none border-0"
                onClick={handleAddToCart}
              >
                <img src={whatsapp} alt="" className="size-6" />
                Order Now
              </button>
              <div className="flex space-x-4 mb-6">
                <button
                  className="btn btn-primary text-secondary flex-1 rounded-none font-heading shadow-none border-0"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={20} /> Add to Cart
                </button>
                <button
                  className="btn btn-outline btn-primary flex-1 rounded-none font-heading shadow-none"
                  onClick={handleAddToWishlist}
                >
                  <Heart size={20} />
                  Wishlist
                </button>
              </div> */}
            </div>
          </motion.div>
        </div>
      </div>
      {isAdmin ? (
        <div className="space-y-2 m-2">
          <button
            className="btn btn-sm btn-circle btn-elegant mr-2 w-full"
            onClick={() => handleEditCollection(collectionId)}
          >
            <Pen /> Edit Collection
          </button>
          <button
            className="btn btn-outline btn-error w-full"
            onClick={() => handleDeleteCollection(collectionId)}
          >
            {isDeletingCollection ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}{' '}
            Delete Collection
          </button>
        </div>
      ) : null}
      {!isAdmin ? (
        <div className="px-4 mb-6 sm:flex space-x-2 space-y-2">
          <a
            className=" btn btn-md bg-green-600 hover:bg-green-700 text-white flex-1 w-full border-0 font-heading"
            href={whatsappHref(collection)}
          >
            <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png"} alt="" className="size-6" />
            Order Now
          </a>

          <button
            className="btn btn-md btn-elegant flex-1 w-full"
            onClick={() => handleAddToCart(collectionId, 1, 'Collection')}
          >
            {isAddingToCart ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ShoppingCart size={20} />
            )}
            Add to Cart
          </button>
          {isInWishlist(collectionId) ? (
            <button
              className="btn btn-md btn-elegant-outline flex-1 w-full"
              onClick={() =>
                handleRemovefromWishlist(collectionId, 'Collection')
              }
            >
              {isRemovingFromwishlist ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Heart size={20} className="fill-white stroke-0" />
              )}
            </button>
          ) : (
            <button
              className="btn btn-md btn-elegant-outline flex-1 w-full"
              onClick={() => handleAddToWishlist(collectionId, 'Collection')}
            >
              {isAddingTowishlist ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Heart size={20} />
              )}
              Wishlist
            </button>
          )}
        </div>
      ) : null}
      <p
        className="px-4 py-8 max-w-7xl mx-auto text-neutral/70 leading-relaxed text-base"
        dangerouslySetInnerHTML={{ __html: collection.description }}
      ></p>
      {/* Products in this Collection */}
      <h2 className=" mt-12 text-2xl font-heading font-semibold text-center mb-8 text-neutral">
        Products in this Collection
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        {productsInCollection.map((product, index) => (
          <motion.div
            key={product._id}
            className="group"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (index % 4) * 0.1, ease: luxuryEase }}
            whileHover={{ y: -6, boxShadow: '0 16px 32px rgba(0,0,0,0.1)' }}
          >
            <figure className="relative h-60 w-full img-zoom overflow-hidden">
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
                  className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110"
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
                    className="absolute top-3 right-3"
                    aria-label="reomove from wishlist"
                    onClick={() =>
                      handleRemovefromWishlist(product._id, 'Collection')
                    }
                  >
                    {isRemovingFromwishlist ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Heart className="text-primary size-7 fill-primary" />
                    )}
                  </button>
                ) : (
                  <button
                    className="absolute top-3 right-3"
                    aria-label="Add to wishlist"
                    onClick={() =>
                      handleAddToWishlist(product._id, 'Collection')
                    }
                  >
                    {isAddingTowishlist ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Heart className="text-primary size-7" />
                    )}
                  </button>
                )
              ) : null}
              <span className="absolute bottom-3 left-3 text-xs tracking-wider uppercase text-white/90 text-shadow-md font-medium">
                {product.style}
              </span>
            </figure>

            <div className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-heading font-semibold text-neutral truncate">
                    {product.name}
                  </h2>

                  {/* {product.collectionId && product.collectionId.name && (
                    <p className="text-sm text-neutral/60 mb-1">
                      Collection: {product.collectionId.name}
                    </p>
                  )} */}
                  {product.isPromo && product.discountedPrice !== undefined ? (
                    <div className="flex flex-col">
                      <span className="text-xl font-body font-bold text-secondary">
                        ₦
                        {Number(product.discountedPrice).toLocaleString(
                          'en-NG',
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </span>
                      <span className="text-neutral/40 line-through text-sm-sm">
                        ₦
                        {Number(product.price).toLocaleString('en-NG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-lg text-secondary">
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
                      className="btn btn-sm btn-circle bg-green-600 hover:bg-green-700 text-white border-0"
                      href={whatsappHref(product)}
                    >
                      <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png"} alt="WhatsApp" className="size-5" />
                    </a>
                    <button
                      className="btn btn-sm btn-circle btn-elegant"
                      onClick={() => handleAddToCart(product._id, 1, 'Product')}
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
          </motion.div>
        ))}
      </div>

      {!isAdmin && (
        <div className="mt-12">
          <h2 className="font-heading text-xl font-semibold text-neutral mb-4">
            Reviews
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-base-300 p-4">
              <p className="text-sm text-neutral/60 mb-2">
                Average rating: {collection.averageRating || 0} / 5
              </p>
              {authUser ? (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Rating</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Comment</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      rows="3"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingReview}
                  >
                    {isSubmittingReview ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      'Submit Review'
                    )}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate('/login')}
                >
                  Login to review
                </button>
              )}
            </div>

            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-neutral/60">No reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review._id} className="border border-base-300 p-3">
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* ===== Collection Banners ===== */}
      {banners.filter((b) => b.position === 'collection').length > 0 && (
        <SectionReveal className="py-8 px-6 sm:px-10 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {banners
              .filter((b) => b.position === 'collection')
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
    </PageWrapper>
  );
};

export default CollectionDetailsPage;
