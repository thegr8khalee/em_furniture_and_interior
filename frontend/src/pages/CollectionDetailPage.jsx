// src/pages/CollectionDetailsPage.jsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  ShoppingCart,
  Heart,
  ChevronLeft,
  Share,
  Share2,
} from 'lucide-react';
// import { useAdminStore } from '../store/useAdminStore'; // To get collection details
import { useProductsStore } from '../store/useProductsStore'; // To get all products and filter them
import { useCollectionStore } from '../store/useCollectionStore';
import whatsapp from '../images/whatsapp.png';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
// import { useAdminStore } from '../store/useAdminStore';
import { useAuthStore } from '../store/useAuthStore';

const CollectionDetailsPage = () => {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  const { collection, getCollectionById, isGettingCollection } =
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

  const { isAdmin } = useAuthStore();

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, getCollectionById, getProducts, getwishlist]);

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

  const handleProductClick = (Id) => {
    navigate(`/product/${Id}`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
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
  if (isGettingCollection || isGettingProducts) {
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
      <div className="text-center text-xl text-gray-600 mt-16">
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
    <div className="pt-15">
      <div className="w-full flex justify-between">
        <button
          onClick={() => {
            navigate(-1);
            setTimeout(() => {
              window.scrollTo(0, 0);
            }, 10);
          }}
          className="btn btn-circle mx-4 mt-2"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
          }}
          className="btn btn-circle mx-4 mt-2"
        >
          <Share2 size={20} />
        </button>
      </div>
      {/* Collection Header */}
      <div className="bg-base-100 p-4">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <figure className="w-full md:w-1/2 aspect-video sm:aspect-[4/3] max-h-[400px] bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
            <img
              src={
                collection.coverImage?.url ||
                'https://placehold.co/600x400/E0E0E0/333333?text=No+Cover'
              }
              alt={collection.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  'https://placehold.co/600x400/E0E0E0/333333?text=Image+Error';
              }}
            />
          </figure>
          <div className="w-full">
            <div className="md:w-full space-y-1 md:text-left">
              <div className="flex space-x-2 font-normal text-gray-500 items-center text-xs sm:text-base">
                <p>{collection.style}</p>
                {collection.isForeign && collection.origin && (
                  <span>| Made in {collection.origin}</span>
                )}
              </div>
              <h1 className="text-3xl font-bold font-[poppins]">
                {collection.name}
              </h1>
              <div className="flex space-x-3">
                {collection.isPromo &&
                collection.discountedPrice !== undefined ? (
                  <>
                    <span className="text-red-600 font-bold text-xl">
                      N{collection.discountedPrice.toFixed(2)}
                    </span>
                    <span className="text-gray-500 line-through text">
                      N{collection.price.toFixed(2)}
                    </span>
                    <span className="text-green-600 text font-semibold">
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
                  <span className="text-red-600 font-bold text-xl">
                    N{collection.price.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text text-gray-700 font-[montserrat]">
                {collection.description}
              </p>
              {/* <button
                className="my-4 btn bg-green-500 text-base-100 w-full rounded-xl font-[poppins] shadow-none border-0"
                onClick={handleAddToCart}
              >
                <img src={whatsapp} alt="" className="size-6" />
                Order Now
              </button>
              <div className="flex space-x-4 mb-6">
                <button
                  className="btn btn-primary text-secondary flex-1 rounded-xl font-[poppins] shadow-none border-0"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={20} /> Add to Cart
                </button>
                <button
                  className="btn btn-outline btn-primary flex-1 rounded-xl font-[poppins] shadow-none"
                  onClick={handleAddToWishlist}
                >
                  <Heart size={20} />
                  Wishlist
                </button>
              </div> */}
            </div>
          </div>
        </div>
      </div>
      {!isAdmin ? (
        <div className="px-4 mb-6 sm:flex space-x-2 space-y-2">
          <a
            className=" btn bg-green-500 text-base-100 flex-3 w-full rounded-xl font-[poppins] shadow-none border-0"
            href={whatsappHref(collection)}
          >
            <img src={whatsapp} alt="" className="size-6" />
            Order Now
          </a>

          <button
            className="btn btn-primary text-secondary flex-3 w-full rounded-xl font-[poppins] shadow-none border-0"
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
              className="btn btn-primary flex-3 w-full rounded-xl font-[poppins] shadow-none"
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
              className="btn btn-outline btn-primary flex-3 w-full rounded-xl font-[poppins] shadow-none"
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
      {/* Products in this Collection */}
      <h2 className="text-xl font-bold mb-6 text-center font-[poppins]">
        Products in this Collection
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
        {productsInCollection.map((product) => (
          <div key={product._id} className=" rounded-xl overflow-hidden">
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
              <span className="absolute bottom-3 left-3 text-base text-shadow-lg truncate text-base-100 font-[montserrat]">
                {product.style}
              </span>
            </figure>

            <div className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold truncate">
                    {product.name}
                  </h2>

                  {product.collectionId && product.collectionId.name && (
                    <p className="text-sm text-gray-500 mb-1">
                      Collection: {product.collectionId.name}
                    </p>
                  )}
                  {product.isPromo && product.discountedPrice !== undefined ? (
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
                {!isAdmin ? (
                  <div className="space-x-1">
                    <a className="btn rounded-xl bg-green-400" href={whatsappHref(product)}>
                      <img src={whatsapp} alt="WhatsApp" className="size-5" />
                    </a>
                    <button
                      className="btn rounded-xl bg-primary"
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
          </div>
        ))}
      </div>
      )
    </div>
  );
};

export default CollectionDetailsPage;
