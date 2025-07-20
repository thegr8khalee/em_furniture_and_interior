/* eslint-disable no-unused-vars */
// src/pages/CartPage.jsx
import React, { useEffect, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { Loader2, Trash2, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios.js';
import whatsapp from '../images/whatsapp.png';
import Hero1 from '../images/Hero1.png';
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
      getCart();
    }
  }, [getCart, isAuthReady]);

  // Effect to fetch detailed product/collection info for each item in the cart
  useEffect(() => {
    const fetchItemDetails = async () => {
      // Only proceed if cart data is available and has items
      // cart is now an array, so check cart.length
      if (cart && cart.length > 0) {
        setIsFetchingDetails(true);
        const fetchedDetails = [];

        for (const cartItem of cart) {
          // Iterate directly over cart array
          const itemId = cartItem.item; // This is the actual Product/Collection ID
          const itemType = cartItem.itemType; // 'Product' or 'Collection'
          const quantity = cartItem.quantity;
          const cartEntryId = cartItem._id; // The unique ID of this cart entry

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
                // Include original cart item properties (like _id for key, quantity)
                _id: cartEntryId, // Use the cart entry's unique ID as key
                item: itemId, // The original product/collection ID
                itemType: itemType, // The original type
                quantity: quantity,

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
              _id: cartEntryId,
              item: itemId,
              itemType: itemType,
              quantity: quantity,
              name: `Unknown ${itemType} (ID: ${itemId.substring(0, 6)}...)`,
              imageUrl: 'https://placehold.co/100x100/E0E0E0/333333?text=N/A',
              displayPrice: 0,
              error: true,
            });
          }
        }
        setDetailedCartItems(fetchedDetails);
        setIsFetchingDetails(false);
      } else {
        setDetailedCartItems([]); // Clear detailed items if cart is empty or not yet loaded
        setIsFetchingDetails(false);
      }
    };

    // Only run this effect if cart is not null and its items array is different
    // from the last time, or if the identification status changes.
    fetchItemDetails();
  }, [cart, _isUserOrGuestIdentified]); // Depend on cart and identification status

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
  if (!cart || cart.length === 0) {
    return (
      <div className="py-16 overflow-x-hidden">
        <div className="text-center text-xl text-gray-600 mt-16">
          Your cart is empty.{' '}
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
    <div className="pt-12 w-screen">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-40 w-full" />
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
                          {!isRemovingFromCart ? (
                            <X className="size-4" />
                          ) : (
                            <Loader2 className="animate-spin" />
                          )}
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
                          disabled={isUpdatingCartItem || item.quantity <= 1}
                        >
                          {!isUpdatingCartItem ? (
                            <Minus size={16} />
                          ) : (
                            <Loader2 className="animate-spin" />
                          )}
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
                          disabled={isUpdatingCartItem}
                        >
                          {!isUpdatingCartItem ? (
                            <Plus size={16} />
                          ) : (
                            <Loader2 className="animate-spin" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClearCart}
                className="btn btn-error rounded-xl"
                disabled={isRemovingFromCart}
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
            >
              <img src={whatsapp} alt="" className="size-8" /> Order On WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
