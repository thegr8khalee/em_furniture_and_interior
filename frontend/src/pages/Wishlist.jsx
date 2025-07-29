/* eslint-disable no-unused-vars */
// src/pages/WishlistPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore'; // Import cart store for "Add to Cart"
import { Loader2, Trash2, ShoppingCart, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js'; // For fetching product/collection details
// import Hero1 from '../images/Hero1.png';
import { useAuthStore } from '../store/useAuthStore.js';

const WishlistPage = () => {
  const {
    wishlist, // This is now an array of wishlist items: [{item: ID, itemType: Type, _id: WISHLIST_ENTRY_ID}, ...]
    isGettingWishlist,
    // isAddingToWishlist, // Used for general wishlist operations loading
    // isRemovingFromWishlist, // Specific for remove/clear
    getwishlist,
    removeFromwishlist,
    clearWishlist,
  } = useWishlistStore();

  const {
    addToCart,
    isAddingToCart, // Loading state for adding to cart
  } = useCartStore();

  const { isAuthReady } = useAuthStore();

  const [detailedWishlistItems, setDetailedWishlistItems] = useState([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const [hasInitialWishlistLoaded, setHasInitialWishlistLoaded] =
    useState(false); // New state to track initial wishlist data load

  // Ref to store the previous wishlist items to detect additions/removals
  const prevWishlistRef = useRef([]);

  useEffect(() => {
    if (isAuthReady) {
      getwishlist().then(() => {
        // Once getwishlist completes (successfully or with error), mark initial load as true
        setHasInitialWishlistLoaded(true);
      });
    }
  }, [getwishlist, isAuthReady]);

  // Effect to fetch detailed product/collection info for each item in the wishlist
  useEffect(() => {
    const fetchItemDetails = async () => {
      // IMPORTANT: Only clear detailed items if wishlist is empty AND we are NOT currently fetching it.
      if (!hasInitialWishlistLoaded) {
        console.log(
          'Initial wishlist data not loaded yet, deferring detailed items fetch.'
        );
        return;
      }

      // If wishlist is empty (and we've confirmed the initial load completed), clear detailed items.
      if (!wishlist || wishlist.length === 0) {
        setDetailedWishlistItems([]);
        setIsFetchingDetails(false);
        console.log(
          'Wishlist is empty after initial load, clearing detailedWishlistItems.'
        );
        return;
      }

      // Extract all unique product and collection IDs from the wishlist
      const productIds = [];
      const collectionIds = [];

      wishlist.forEach((wishlistItem) => {
        if (wishlistItem.itemType === 'Product') {
          productIds.push(wishlistItem.item);
        } else if (wishlistItem.itemType === 'Collection') {
          collectionIds.push(wishlistItem.item);
        }
      });

      // If there are no items, clear details and return
      if (productIds.length === 0 && collectionIds.length === 0) {
        setDetailedWishlistItems([]);
        setIsFetchingDetails(false);
        return;
      }

      setIsFetchingDetails(true); // Indicate that details are being fetched
      try {
        // --- BATCHED API CALL ---
        // This assumes you have a backend endpoint like /api/items/details-by-ids
        // that accepts an array of productIds and collectionIds and returns
        // an object like { products: [...], collections: [...] }
        const res = await axiosInstance.post('/cart/details-by-ids', {
          productIds,
          collectionIds,
        });

        const { products, collections } = res.data;

        // Create maps for quick lookup of details by ID
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));
        const collectionMap = new Map(
          collections.map((c) => [c._id.toString(), c])
        );

        // Map the original wishlist items to their detailed versions
        const fetchedDetails = wishlist.map((wishlistItem) => {
          let detail = null;
          const wishlistItemIdString = wishlistItem.item.toString(); // Ensure ID is string for map lookup

          if (wishlistItem.itemType === 'Product') {
            detail = productMap.get(wishlistItemIdString);
          } else if (wishlistItem.itemType === 'Collection') {
            detail = collectionMap.get(wishlistItemIdString);
          }

          if (detail) {
            return {
              _id: wishlistItem._id, // Use the wishlist entry's unique ID as key
              item: wishlistItem.item, // The original product/collection ID
              itemType: wishlistItem.itemType, // The original type
              // Spread the fetched details (name, price, images etc.)
              ...detail,
              imageUrl:
                wishlistItem.itemType === 'Collection'
                  ? detail.coverImage?.url
                  : detail.images?.[0]?.url,
              // Assuming wishlist might also show a price (promo or regular)
              displayPrice:
                detail.isPromo && detail.discountedPrice !== undefined
                  ? detail.discountedPrice
                  : detail.price,
            };
          } else {
            // Handle case where item details could not be found (e.g., item deleted from DB)
            return {
              _id: wishlistItem._id,
              item: wishlistItem.item,
              itemType: wishlistItem.itemType,
              name: `Unknown ${wishlistItem.itemType} (ID: ${wishlistItem.item
                .toString()
                .substring(0, 6)}...)`,
              imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=N/A',
              displayPrice: 0,
              error: true, // Mark this item as having an error
            };
          }
        });
        setDetailedWishlistItems(fetchedDetails);
      } catch (error) {
        console.error('Error fetching batched wishlist item details:', error);
        // Fallback to showing placeholders or an error message for all items if batch fetch fails
        setDetailedWishlistItems(
          wishlist.map((wishlistItem) => ({
            _id: wishlistItem._id,
            item: wishlistItem.item,
            itemType: wishlistItem.itemType,
            name: `Error loading ${
              wishlistItem.itemType
            } (ID: ${wishlistItem.item.toString().substring(0, 6)}...)`,
            imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=Error',
            displayPrice: 0,
            error: true,
          }))
        );
        // toast.error('Failed to load some wishlist item details. Please refresh.');
      } finally {
        setIsFetchingDetails(false); // End fetching details
      }
    };

    fetchItemDetails();
    prevWishlistRef.current = wishlist; // Update ref with current wishlist after processing
  }, [wishlist, hasInitialWishlistLoaded]); // Depend on the raw wishlist state

  // Handler for removing an item from the wishlist
  const handleRemoveItem = async (itemId, itemType) => {
    await removeFromwishlist(itemId, itemType);
  };

  // Handler for clearing the entire wishlist
  const handleClearWishlist = async () => {
    await clearWishlist();
  };

  // Handler for adding an item from wishlist to cart
  const handleAddToCartFromWishlist = async (
    itemId,
    quantity = 1,
    itemType
  ) => {
    await addToCart(itemId, quantity, itemType);
    await removeFromwishlist(itemId, itemType);
  };

  const navigate = useNavigate();

  const handleShopClick = () => {
    navigate(`/shop`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  // Overall loading state for the page
  // const isLoadingPage =
  //   isGettingWishlist || isFetchingDetails || isAddingToWishlist;

  if (isGettingWishlist) {
    return (
      <div className="pt-16">
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Check if wishlist is empty after loading and fetching details
  // if (!wishlist || wishlist.length === 0) {
  //   return (
  //     <div className="py-16 overflow-x-hidden">
  //       <div className="text-center text-xl text-gray-600 mt-16">
  //         Your wishlist is empty.{' '}
  //         <button
  //           className="btn bg-primary rounded-xl"
  //           onClick={() => handleShopClick()}
  //         >
  //           Start shopping!
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="pt-16">
      <div className="relative">
        <img
          src={
            'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png'
          }
          alt=""
          className="object-cover h-40 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-10 left-1/2 -translate-x-1/2 mt-20 w-full mb-2 text-3xl font-bold text-center text-base-100 font-[poppins]">
            Your Wishlist
          </h1>
        </div>
      </div>
      <div className="container mx-auto p-2 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Wishlist Items List */}
          <div className="flex-1 bg-base-100 p-2 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">
              Items ({detailedWishlistItems.length})
            </h2>
            <div className="space-y-4">
              {detailedWishlistItems.map(
                (
                  item // 'item' here is the detailed item
                ) => (
                  <div
                    key={item._id} // Use the unique ID of the wishlist entry for the key
                    className="flex items-center border-b border-base-200 pb-4 last:border-b-0"
                  >
                    <div className="w-35 h-24 m-2">
                      <img
                        src={
                          item.imageUrl ||
                          'https://placehold.co/100x100/E0E0E0/333333?text=N/A'
                        }
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg mr-4"
                      />
                    </div>
                    <div className="w-full">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold font-[poppins]">
                          {item.name}
                        </h3>
                        <p className="text-gray-600 text-sm font-[montserrat]">
                          {item.itemType}
                        </p>
                      </div>
                      <div className="flex items-center justify-between space-x-2 w-full">
                        <div>
                          <p className="text font-montserrat">
                            ₦
                            {item.displayPrice !== undefined &&
                            item.displayPrice !== null
                              ? Number(item.displayPrice).toLocaleString(
                                  'en-NG',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )
                              : '0.00'}
                          </p>
                        </div>
                        <div className="flex">
                          <button
                            onClick={() =>
                              handleAddToCartFromWishlist(
                                item.item,
                                1,
                                item.itemType
                              )
                            } // Add to cart with quantity 1
                            className="btn btn-sm bg-primary rounded-xl"
                            // disabled={isAddingToCart}
                          >
                            <ShoppingCart size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleRemoveItem(item.item, item.itemType)
                            }
                            className="btn btn-sm btn-error btn-outline rounded-xl ml-2"
                            // disabled={isRemovingFromWishlist}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            {!detailedWishlistItems || detailedWishlistItems.length === 0 ? (
              <div className="text-center text-xl text-gray-600 mt-16">
                Your wishlist is empty.{' '}
                <button
                  className="btn bg-primary rounded-xl"
                  onClick={() => handleShopClick()}
                >
                  Start shopping!
                </button>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleClearWishlist}
                className="btn btn-error rounded-xl"
                disabled={
                  !detailedWishlistItems || detailedWishlistItems.length === 0
                }
              >
                <Trash2 size={20} className="mr-2" />
                {/* )} */}
                Clear Wishlist
              </button>
            </div>
          </div>

          {/* Wishlist Summary (simplified, no total price) */}
          <div className="lg:w-1/3 bg-base-100 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 font-[poppins]">
              Wishlist Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="font-[montserrat]">Total Items</span>
                <span className="font-bold">
                  {detailedWishlistItems.length}
                </span>
              </div>
              {/* No total price as per backend structure */}
            </div>
            <Link
              to="/shop"
              className="btn bg-primary w-full mt-8 rounded-xl font-[poppins]"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WishlistPage;
