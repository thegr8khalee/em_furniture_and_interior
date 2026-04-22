/* eslint-disable no-unused-vars */
// src/pages/WishlistPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore'; // Import cart store for "Add to Cart"
import { Loader2, Trash2, ShoppingCart, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js'; // For fetching product/collection details
// import Hero1 from '../images/Hero1.png';
import { useAuthStore } from '../store/useAuthStore.js';
import { motion } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper } from '../components/animations';
import { Button, Card, EmptyState, ListItemSkeleton, PageHeader } from '../components/ui';
import SEO from '../components/SEO';

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
        return;
      }

      // If wishlist is empty (and we've confirmed the initial load completed), clear detailed items.
      if (!wishlist || wishlist.length === 0) {
        setDetailedWishlistItems([]);
        setIsFetchingDetails(false);
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
      <PageWrapper className="min-h-screen bg-white">
        <section className="content-shell section-shell pt-24">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Curating your saved items
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-primary">
              Loading your wishlist
            </h2>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListItemSkeleton key={index} />
            ))}
          </div>
        </section>
      </PageWrapper>
    );
  }

  // Check if wishlist is empty after loading and fetching details
  // if (!wishlist || wishlist.length === 0) {
  //   return (
  //     <div className="py-16 overflow-x-hidden">
  //       <div className="text-center text-xl text-neutral/70 mt-16">
  //         Your wishlist is empty.{' '}
  //         <button
  //           className="btn bg-primary rounded-none"
  //           onClick={() => handleShopClick()}
  //         >
  //           Start shopping!
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <PageWrapper>
    <SEO title="Your Wishlist" description="Your saved items." canonical="/wishlist" noindex />
    <div className="min-h-screen mt-16 bg-white">
      {/* Hero Banner */}
      <PageHeader
        title="Wishlist"
        subtitle="Your saved items"
        image="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"
        alt="Wishlist"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Wishlist Items List */}
          <Card className="flex-1 surface-elevated" padding="p-4 sm:p-6">
            <h2 className="mb-6 font-heading text-xl font-medium text-neutral">
              Items ({detailedWishlistItems.length})
            </h2>
            <div className="space-y-4">
              {detailedWishlistItems.map(
                (
                  item, index // 'item' here is the detailed item
                ) => (
                  <motion.div
                    key={item._id} // Use the unique ID of the wishlist entry for the key
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08, ease: luxuryEase }}
                    className="flex items-center border-b border-base-200 pb-4 last:border-b-0"
                  >
                    <div className="w-35 h-24 m-2">
                      <img
                        src={
                          item.imageUrl ||
                          'https://placehold.co/100x100/E0E0E0/333333?text=N/A'
                        }
                        alt={item.name}
                        className="w-full h-full object-cover rounded-none mr-4"
                      />
                    </div>
                    <div className="w-full">
                      <div className="flex-1">
                        <h3 className="font-heading text-base font-semibold text-neutral">
                          {item.name}
                        </h3>
                        <p className="text-neutral/50 text-xs">
                          {item.itemType}
                        </p>
                      </div>
                      <div className="flex items-center justify-between space-x-2 w-full">
                        <div>
                          <p className="text-sm text-neutral/70">
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
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleAddToCartFromWishlist(item.item, 1, item.itemType)
                            }
                            leftIcon={ShoppingCart}
                            ariaLabel={`Add ${item.name} to cart`}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveItem(item.item, item.itemType)}
                            leftIcon={Trash2}
                            ariaLabel={`Remove ${item.name} from wishlist`}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              )}
            </div>
            {!detailedWishlistItems || detailedWishlistItems.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Your wishlist is empty"
                description="Save the pieces you love so you can revisit them when you're ready to order."
                actionLabel="Start shopping"
                onAction={handleShopClick}
                className="mt-10"
              />
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button
                variant="danger"
                onClick={handleClearWishlist}
                leftIcon={Trash2}
                disabled={!detailedWishlistItems || detailedWishlistItems.length === 0}
              >
                Clear Wishlist
              </Button>
            </div>
          </Card>

          {/* Wishlist Summary (simplified, no total price) */}
          <Card className="h-fit lg:w-1/3 surface-elevated bg-base-200" padding="p-6">
            <h2 className="mb-6 font-heading text-xl font-medium text-neutral">
              Wishlist Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-neutral/60">Total Items</span>
                <span className="font-medium">{detailedWishlistItems.length}</span>
              </div>
            </div>
            <div className="mt-8">
              <Button to="/shop" fullWidth>
                Continue Shopping
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default WishlistPage;
