/* eslint-disable no-unused-vars */
// src/pages/CartPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { Loader2, Trash2, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js';
// import whatsapp from '../images/whatsapp.png';
// import Hero1 from '../images/Hero1.png';
import { useAuthStore } from '../store/useAuthStore.js';

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
        console.log(
          'Initial cart data not loaded yet, deferring detailed items fetch.'
        );
        return;
      }

      // If cart is empty (and we've confirmed the initial load completed), clear detailed items.
      // This is the desired behavior for an actually empty cart.
      if (!cart || cart.length === 0) {
        setDetailedCartItems([]);
        setIsFetchingDetails(false);
        console.log(
          'Cart is empty after initial load, clearing detailedCartItems.'
        );
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
    console.log('yes');
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

    message += `Total Price: N${calculateOverallTotal().toFixed(2)}\n`;
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

  // Check if cart is empty after loading and fetching details
  // cart is now an array, so check cart.length
  // if (!cart || cart.length === 0) {
  //   return (
  //     <div className="py-16 overflow-x-hidden">
  //       <div className="text-center text-xl text-gray-600 mt-16">
  //         Your cart is empty.{' '}
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
    <div className="pt-12 w-screen">
      <div className="relative">
        <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"} alt="" className="object-cover h-40 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-10 left-1/2 -translate-x-1/2 mt-20 w-full mb-2 text-3xl font-bold text-center text-base-100 font-[poppins]">
            Your Shopping Cart
          </h1>
        </div>
      </div>
      <div className="container mx-auto p-2 sm:p-6 lg:p-8 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items List */}
          <div className="flex-1 bg-base-100 p-2 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">
              Items ({totalItemsInCart})
            </h2>
            <div className="space-y-4">
              {detailedCartItems.map(
                (
                  item // 'item' here is the detailed item
                ) => (
                  <div
                    key={item._id} // Use the unique ID of the cart entry for the key
                    className="flex border-b border-base-200 pb-4 last:border-b-0 overflow-x-auto"
                  >
                    <div className="w-35 h-24">
                      <img
                        src={
                          item.imageUrl ||
                          'https://placehold.co/100x100/E0E0E0/333333?text=N/A'
                        }
                        alt={item.name}
                        className="h-full w-full object-cover rounded-lg mr-4"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            'https://placehold.co/100x100/E0E0E0/333333?text=Error';
                        }}
                      />
                    </div>
                    <div className="flex flex-col w-full px-2">
                      <div className="flex justify-between w-full items-center font-[poppins]">
                        <h3 className="text-lg font-medium">{item.name}</h3>
                        <button
                          type="button"
                          className="btn btn-xs btn-circle"
                          onClick={() =>
                            handleRemoveItem(item._id, item.itemType)
                          }
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      {/* <div className="items-center  font-[montserrat]">
                        {item.itemType}
                      </div> */}
                      <div className=" flex justify-between w-full items-center">
                        {/* <span className="font-light">Price:</span> */}
                      </div>{' '}
                      <div className="flex items-end space-x-1 justify-between w-full">
                        <div className="text font-[montserrat]">
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
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.item,
                              item.itemType,
                              item.quantity,
                              -1
                            )
                          } // Pass item.item (original ID)
                          className="btn btn-circle btn-sm  btn-outline btn-primary"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={16} />
                        </button>

                        <span className="font-semibold text-lg w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(
                              item.item,
                              item.itemType,
                              item.quantity,
                              1
                            )
                          } // Pass item.item (original ID)
                          className="btn btn-circle btn-sm btn-outline btn-primary"
                          // disabled={isUpdatingCartItem}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            {!cart || cart.length === 0 ? (
              <div className="text-center text-xl text-gray-600 mt-16">
                Your cart is empty.{' '}
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
                type="button"
                onClick={handleClearCart}
                className="btn btn-error rounded-xl"
                disabled={isRemovingFromCart || !cart || cart.length === 0}
              >
                {isRemovingFromCart ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Trash2 size={20} className="mr-2" />
                )}
                Clear Cart
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:w-1/3 bg-base-100 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span>Subtotal ({totalItemsInCart} items)</span>
                <span className="font-medium">
                  ₦
                  {Number(calculateOverallTotal()).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="border-t border-base-200 my-4"></div>
              <div className="flex justify-between text-xl font-bold text-red-500">
                <span>Total</span>
                <span>
                  ₦
                  {Number(calculateOverallTotal()).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <a
              className="btn bg-green-500 text-white border-0 shadow-none w-full mt-8 rounded-xl"
              href={whatsappCartHref(detailedCartItems)}
              disabled={isRemovingFromCart || !cart || cart.length === 0}
            >
              <img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png"} alt="" className="size-8" /> Order On WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
