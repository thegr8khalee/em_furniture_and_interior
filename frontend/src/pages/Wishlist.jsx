// src/pages/WishlistPage.jsx
import React, { useEffect, useState } from 'react';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore'; // Import cart store for "Add to Cart"
import { Loader2, Trash2, ShoppingCart, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js'; // For fetching product/collection details
import Hero1 from '../images/Hero1.png';
import { useAuthStore } from '../store/useAuthStore.js';

const WishlistPage = () => {
  const {
    wishlist, // This is now an array of wishlist items: [{item: ID, itemType: Type, _id: WISHLIST_ENTRY_ID}, ...]
    isGettingWishlist,
    // isAddingToWishlist, // Used for general wishlist operations loading
    isRemovingFromWishlist, // Specific for remove/clear
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
  // const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  useEffect(() => {
    if (isAuthReady) {
      getwishlist();
    }
  }, [getwishlist, isAuthReady]);

  // Effect to fetch detailed product/collection info for each item in the wishlist
  useEffect(() => {
    const fetchItemDetails = async () => {
      // Only proceed if wishlist data is available and has items
      if (wishlist && wishlist.length > 0) {
        // setIsFetchingDetails(true);
        const fetchedDetails = [];

        for (const wishlistItem of wishlist) {
          // Iterate directly over wishlist array
          const itemId = wishlistItem.item; // This is the actual Product/Collection ID
          const itemType = wishlistItem.itemType; // 'Product' or 'Collection'
          const wishlistEntryId = wishlistItem._id; // The unique ID of this wishlist entry

          try {
            let endpoint = '';
            if (itemType === 'Product') {
              endpoint = `/products/${itemId}`;
            } else if (itemType === 'Collection') {
              endpoint = `/collections/${itemId}`;
            }

            if (endpoint) {
              const res = await axiosInstance.get(endpoint);
              const detail = res.data; // This is the full product/collection object

              fetchedDetails.push({
                // Include original wishlist item properties (like _id for key, item, itemType)
                _id: wishlistEntryId, // Use the wishlist entry's unique ID as key
                item: itemId, // The original product/collection ID
                itemType: itemType, // The original type

                // Spread the fetched details (name, price, images etc.)
                ...detail,

                // Standardize image URL and display price for easier rendering
                imageUrl:
                  itemType === 'Collection'
                    ? detail.coverImage?.url
                    : detail.images?.[0]?.url,
                displayPrice:
                  detail.isPromo && detail.discountedPrice !== undefined
                    ? detail.discountedPrice
                    : detail.price,
              });
            }
          } catch (error) {
            console.error(
              `Failed to fetch details for item ${itemId} (${itemType}):`,
              error
            );
            // Add a placeholder or error item if fetching fails
            fetchedDetails.push({
              _id: wishlistEntryId,
              item: itemId,
              itemType: itemType,
              name: `Unknown ${itemType} (ID: ${itemId.substring(0, 6)}...)`,
              imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=N/A',
              displayPrice: 0,
              error: true,
            });
          }
        }
        setDetailedWishlistItems(fetchedDetails);
        // setIsFetchingDetails(false);
      } else {
        setDetailedWishlistItems([]); // Clear detailed items if wishlist is empty or not yet loaded
        // setIsFetchingDetails(false);
      }
    };

    // Re-run this effect when the raw wishlist state changes
    fetchItemDetails();
  }, [wishlist]); // Depend on the raw wishlist state

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
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-2 text-lg">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  // Check if wishlist is empty after loading and fetching details
  if (!wishlist || wishlist.length === 0) {
    return (
      <div className="py-16 overflow-x-hidden">
        <div className="text-center text-xl text-gray-600 mt-16">
          Your wishlist is empty.{' '}
          <button
            className="btn bg-primary rounded-xl"
            onClick={() => handleShopClick()}
          >
            Start shopping!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-40 w-full" />
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
                    <img
                      src={
                        item.imageUrl ||
                        'https://placehold.co/100x100/E0E0E0/333333?text=N/A'
                      }
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg mr-4"
                    />
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
                            disabled={isAddingToCart}
                          >
                            {isAddingToCart ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <ShoppingCart size={16} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              handleRemoveItem(item.item, item.itemType)
                            }
                            className="btn btn-sm btn-error btn-outline rounded-xl ml-2"
                            disabled={isRemovingFromWishlist}
                          >
                            {isRemovingFromWishlist ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleClearWishlist}
                className="btn btn-error rounded-xl"
                disabled={isRemovingFromWishlist}
              >
                {isRemovingFromWishlist ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Trash2 size={20} className="mr-2" />
                )}
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
