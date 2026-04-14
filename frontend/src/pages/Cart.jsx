/* eslint-disable no-unused-vars */
// src/pages/CartPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useCouponStore } from '../store/useCouponStore';
import { Loader2, Trash2, Minus, Plus, ShoppingCart, X, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js';
// import whatsapp from '../images/whatsapp.png';
// import Hero1 from '../images/Hero1.png';
import { useAuthStore } from '../store/useAuthStore.js';
import { motion } from 'framer-motion';
import { luxuryEase } from '../lib/animations';
import { PageWrapper } from '../components/animations';
import { Button, Card, EmptyState, Input, ListItemSkeleton, PageHeader } from '../components/ui';

const CartPage = () => {
  const {
    cart, // This is now an array of cart items: [{item: ID, itemType: Type, quantity: N, _id: CART_ENTRY_ID}, ...]
    isGettingCart,
    // isAddingToCart,
    isRemovingFromCart,
    isUpdatingCartItem,
    getCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    _isUserOrGuestIdentified, // Helper to check if identified (for knowing cart source)
  } = useCartStore();

  const { isAuthReady } = useAuthStore();

  const {
    appliedCoupon,
    couponCode,
    discount,
    isValidating,
    couponError,
    setCouponCode,
    validateCoupon,
    removeCoupon,
    clearCouponError
  } = useCouponStore();

  const [detailedCartItems, setDetailedCartItems] = useState([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  useEffect(() => {
    if (isAuthReady) {
      getCart().then(() => {
        // Once getCart completes (successfully or with error), mark initial load as true
        setHasInitialCartLoaded(true);
      });
    }
  }, [getCart, isAuthReady]);

  const [hasInitialCartLoaded, setHasInitialCartLoaded] = useState(false); // State to track initial cart data load

  // Ref to store the previous cart items to detect additions/removals
  const prevCartRef = useRef([]);

  // Effect to fetch detailed product/collection info for each item in the cart
  useEffect(() => {
    const fetchItemDetails = async () => {
      // IMPORTANT: Only clear detailed items if cart is empty AND we are NOT currently fetching it.
      // This prevents momentary clearing while data is still loading.
      if (!hasInitialCartLoaded) {
        return;
      }

      // If cart is empty (and we've confirmed the initial load completed), clear detailed items.
      // This is the desired behavior for an actually empty cart.
      if (!cart || cart.length === 0) {
        setDetailedCartItems([]);
        setIsFetchingDetails(false);
        return;
      }

      // Extract all unique product and collection IDs from the cart
      const productIds = [];
      const collectionIds = [];

      cart.forEach((cartItem) => {
        if (cartItem.itemType === 'Product') {
          productIds.push(cartItem.item);
        } else if (cartItem.itemType === 'Collection') {
          collectionIds.push(cartItem.item);
        }
      });

      // If there are no items, clear details and return
      if (productIds.length === 0 && collectionIds.length === 0) {
        setDetailedCartItems([]);
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
        const productMap = new Map(products.map((p) => [p._id, p]));
        const collectionMap = new Map(collections.map((c) => [c._id, c]));

        // Map the original cart items to their detailed versions
        const fetchedDetails = cart.map((cartItem) => {
          let detail = null;
          if (cartItem.itemType === 'Product') {
            detail = productMap.get(cartItem.item);
          } else if (cartItem.itemType === 'Collection') {
            detail = collectionMap.get(cartItem.item);
          }

          if (detail) {
            return {
              _id: cartItem._id, // Use the cart entry's unique ID as key for React list rendering
              item: cartItem.item, // The original product/collection ID
              itemType: cartItem.itemType, // The original type
              quantity: cartItem.quantity,
              ...detail, // Spread the fetched details (name, price, images etc.)
              imageUrl:
                cartItem.itemType === 'Collection'
                  ? detail.coverImage?.url
                  : detail.images?.[0]?.url,
              displayPrice:
                detail.isPromo && detail.discountedPrice !== undefined
                  ? detail.discountedPrice
                  : detail.price,
            };
          } else {
            // Handle case where item details could not be found (e.g., item deleted from DB)
            return {
              _id: cartItem._id,
              item: cartItem.item,
              itemType: cartItem.itemType,
              quantity: cartItem.quantity,
              name: `Unknown ${
                cartItem.itemType
              } (ID: ${cartItem.item.substring(0, 6)}...)`,
              imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=N/A',
              displayPrice: 0,
              error: true, // Mark this item as having an error
            };
          }
        });
        setDetailedCartItems(fetchedDetails);
      } catch (error) {
        console.error('Error fetching batched item details:', error);
        // Fallback to showing placeholders or an error message for all items if batch fetch fails
        setDetailedCartItems(
          cart.map((cartItem) => ({
            _id: cartItem._id,
            item: cartItem.item,
            itemType: cartItem.itemType,
            quantity: cartItem.quantity,
            name: `Error loading ${
              cartItem.itemType
            } (ID: ${cartItem.item.substring(0, 6)}...)`,
            imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=Error',
            displayPrice: 0,
            error: true,
          }))
        );
        // toast.error('Failed to load some cart item details. Please refresh.');
      } finally {
        setIsFetchingDetails(false); // End fetching details
      }
    };

    fetchItemDetails();
    prevCartRef.current = cart; // Update ref with current cart after processing
  }, [cart, hasInitialCartLoaded]); // Depend on cart and identification status

  // Handler for removing an item from the cart
  const handleRemoveItem = async (itemId, itemType) => {
    await removeFromCart(itemId, itemType);
  };

  // Handler for clearing the entire cart
  const handleClearCart = async (e) => {
    e.preventDefault();
    await clearCart();
  };

  // Handler for updating item quantity
  const handleUpdateQuantity = async (
    itemId,
    itemType,
    currentQuantity,
    change
  ) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) {
      // If quantity drops to 0 or less, confirm removal
      if (window.confirm('Do you want to remove this item from your cart?')) {
        await updateCartItemQuantity(itemId, itemType, newQuantity); // This will internally call removeFromCart if newQuantity is 0
      }
    } else {
      await updateCartItemQuantity(itemId, itemType, newQuantity);
    }
  };

  // Calculate overall total from detailed items (since backend does not provide it)
  const calculateOverallTotal = () => {
    return detailedCartItems.reduce((total, item) => {
      const itemPrice = item.displayPrice || 0;
      return total + itemPrice * item.quantity;
    }, 0);
  };

  const subtotal = calculateOverallTotal();
  const finalTotal = subtotal - discount;

  const totalItemsInCart = detailedCartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const navigate = useNavigate();

  const handleShopClick = () => {
    navigate(`/shop`);
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const whatsappNumber = '2349037691860'; // REPLACE WITH YOUR ACTUAL PHONE NUMBER

  // Helper function to get the link for a product or collection item
  const getItemLink = (item) => {
    const baseUrl = window.location.origin;
    if (item.itemType === 'Product') {
      return `${baseUrl}/product/${item.item}`; // item.item holds the Product ID
    } else if (item.itemType === 'Collection') {
      return `${baseUrl}/collection/${item.item}`; // item.item holds the Collection ID
    }
    return ''; // Fallback if type is unknown
  };

  // Function to calculate the overall total from detailedCartItems
  // const calculateOverallTotal = () => {
  //     return detailedCartItems.reduce((total, item) => {
  //         const itemPrice = item.displayPrice || 0;
  //         return total + (itemPrice * item.quantity);
  //     }, 0);
  // };

  // FIX: Construct the full message with detailed cart items, their links, and total price
  const fullMessage = (items) => {
    let message =
      "Hello, I'd like to place an order for the following items from my cart:\n\n";

    items.forEach((item, index) => {
      const link = getItemLink(item); // Get the specific link for this item
      message += `${index + 1}. ${item.name} (Qty: ${item.quantity}) - N${
        item.displayPrice?.toFixed(2) || '0.00'
      }`;
      if (link) {
        message += `\n   Link: ${link}`; // Add the link on a new line, indented
      }
      message += `\n\n`; // Add an extra newline for better spacing between items
    });

    message += `Subtotal: N${subtotal.toFixed(2)}\n`;
    if (discount > 0) {
      message += `Discount (${appliedCoupon?.code}): -N${discount.toFixed(2)}\n`;
    }
    message += `Total Price: N${finalTotal.toFixed(2)}\n`;
    message += `\nThank you!`;

    return encodeURIComponent(message);
  };

  // Construct the WhatsApp href for the entire cart
  const whatsappCartHref = () => {
    if (!detailedCartItems || detailedCartItems.length === 0) {
      return '#';
    }
    return `https://wa.me/${whatsappNumber}?text=${fullMessage(
      detailedCartItems
    )}`;
  };

  // Overall loading state for the page
  // const isLoadingPage =
  //   isGettingCart ||
  //   isFetchingDetails ||
  //   isAddingToCart ||
  //   isRemovingFromCart ||
  //   isUpdatingCartItem;

  // console.log(detailedCartItems);

  if (isGettingCart) {
    return (
      <PageWrapper className="min-h-screen bg-white">
        <section className="content-shell section-shell pt-24">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Preparing your cart
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-primary">
              Reviewing your selections
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

  // Check if cart is empty after loading and fetching details
  // cart is now an array, so check cart.length
  // if (!cart || cart.length === 0) {
  //   return (
  //     <div className="py-16 overflow-x-hidden">
  //       <div className="text-center text-xl text-neutral/70 mt-16">
  //         Your cart is empty.{' '}
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
    <div className="min-h-screen mt-16 bg-white">
      {/* Hero Banner */}
      <PageHeader
        title="Shopping Cart"
        subtitle={`${totalItemsInCart} item${totalItemsInCart === 1 ? '' : 's'}`}
        image="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"
        alt="Shopping cart"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items List */}
          <Card className="flex-1 surface-elevated" padding="p-4 sm:p-6">
            <h2 className="mb-6 font-heading text-xl font-bold text-neutral">
              Items ({totalItemsInCart})
            </h2>
            <div className="space-y-4">
              {detailedCartItems.map(
                (
                  item, index // 'item' here is the detailed item
                ) => (
                  <motion.div
                    key={item._id} // Use the unique ID of the cart entry for the key
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08, ease: luxuryEase }}
                    className="flex border-b border-base-200 pb-4 last:border-b-0 overflow-x-auto"
                  >
                    <div className="w-35 h-24">
                      <img
                        src={
                          item.imageUrl ||
                          'https://placehold.co/100x100/E0E0E0/333333?text=N/A'
                        }
                        alt={item.name}
                        className="h-full w-full object-cover rounded-none mr-4"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            'https://placehold.co/100x100/E0E0E0/333333?text=Error';
                        }}
                      />
                    </div>
                    <div className="flex flex-col w-full px-2">
                      <div className="flex justify-between w-full items-center">
                        <h3 className="font-heading text-base font-semibold text-neutral">{item.name}</h3>
                        <Button
                          type="button"
                          variant="icon"
                          size="icon"
                          onClick={() => handleRemoveItem(item._id, item.itemType)}
                          ariaLabel={`Remove ${item.name} from cart`}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {/* <div className="items-center  font-body">
                        {item.itemType}
                      </div> */}
                      <div className=" flex justify-between w-full items-center">
                        {/* <span className="font-light">Price:</span> */}
                      </div>{' '}
                      <div className="flex items-end space-x-1 justify-between w-full">
                        <div className="text-sm text-neutral/70">
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
                        </div>
                      </div>
                      <div className="space-x-2 flex items-center w-full justify-end">
                        <Button
                          type="button"
                          variant="icon"
                          size="icon"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.item,
                              item.itemType,
                              item.quantity,
                              -1
                            )
                          }
                          disabled={item.quantity <= 1}
                          ariaLabel={`Decrease quantity for ${item.name}`}
                        >
                          <Minus size={16} />
                        </Button>

                        <span className="font-semibold text-lg w-8 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="icon"
                          size="icon"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.item,
                              item.itemType,
                              item.quantity,
                              1
                            )
                          }
                          ariaLabel={`Increase quantity for ${item.name}`}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )
              )}
            </div>
            {!cart || cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Your cart is empty"
                description="Add a few beautiful pieces to continue with your order."
                actionLabel="Start shopping"
                onAction={handleShopClick}
                className="mt-10"
              />
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="danger"
                onClick={handleClearCart}
                isLoading={isRemovingFromCart}
                leftIcon={Trash2}
                disabled={!cart || cart.length === 0}
              >
                Clear Cart
              </Button>
            </div>
          </Card>

          {/* Order Summary */}
          <Card className="h-fit lg:w-1/3 surface-elevated bg-base-200" padding="p-6">
            <h2 className="font-heading text-xl font-bold text-neutral mb-6">Order Summary</h2>

            {/* Coupon Code Input */}
            <div className="mb-6">
              <label className="label">
                <span className="label-text font-medium">Have a coupon code?</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter coupon code"
                  className="flex-1 uppercase"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={isValidating || appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={removeCoupon}
                    disabled={isValidating}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => validateCoupon(cart, subtotal)}
                    disabled={isValidating || !couponCode.trim()}
                    isLoading={isValidating}
                  >
                    Apply
                  </Button>
                )}
              </div>
              {couponError && (
                <p className="text-error text-sm mt-2">{couponError}</p>
              )}
              {appliedCoupon && (
                <div className="alert alert-success mt-2 py-2">
                  <Tag size={16} />
                  <span className="text-sm">Coupon "{appliedCoupon.code}" applied!</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span>Subtotal ({totalItemsInCart} items)</span>
                <span className="font-medium">
                  ₦
                  {Number(subtotal).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span className="font-medium">
                    -₦
                    {Number(discount).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="border-t border-base-200 my-4"></div>
              <div className="flex justify-between text-xl font-bold text-red-500">
                <span>Total</span>
                <span>
                  ₦
                  {Number(finalTotal).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <Button
              href={whatsappCartHref(detailedCartItems)}
              className="mt-8 w-full border-0 bg-green-600 text-white hover:bg-green-700 hover:text-white"
              disabled={isRemovingFromCart || !cart || cart.length === 0}
            >
              Order On WhatsApp
            </Button>
            <Button
              onClick={() => navigate('/checkout')}
              variant="primary"
              fullWidth
              className="mt-2"
              disabled={isRemovingFromCart || !cart || cart.length === 0}
            >
              Proceed to Checkout
            </Button>
          </Card>
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default CartPage;
