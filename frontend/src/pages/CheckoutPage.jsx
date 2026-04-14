import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useCouponStore } from '../store/useCouponStore';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, ShoppingBag, Truck, CreditCard, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { axiosInstance } from '../lib/axios';
import { PageWrapper } from '../components/animations';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart } = useCartStore();
  const { user } = useAuthStore();
  const { appliedCoupon, discount, couponCode, validateCoupon, removeCoupon } = useCouponStore();
  const { createOrder, isCreatingOrder, clearCurrentOrder } = useOrderStore();

  // Form state
  const [shippingAddress, setShippingAddress] = useState({
    fullName: user ? `${user.firstName} ${user.lastName}` : '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    postalCode: ''
  });

  const [billingAddress, setBillingAddress] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    postalCode: ''
  });

  const [useSameAddressForBilling, setUseSameAddressForBilling] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('whatsapp');
  const [notes, setNotes] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Cart details state
  const [detailedCartItems, setDetailedCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [shippingCost] = useState(0); // For now, free shipping
  const [taxAmount, setTaxAmount] = useState(0);
  const [isCalculatingTax, setIsCalculatingTax] = useState(false);

  // Load detailed cart items
  useEffect(() => {
    const fetchCartDetails = async () => {
      if (!cart || cart.length === 0) {
        navigate('/cart');
        return;
      }

      try {
        const { axiosInstance } = await import('../lib/axios.js');
        const productIds = cart.filter(item => item.itemType === 'Product').map(item => item.item);
        const collectionIds = cart.filter(item => item.itemType === 'Collection').map(item => item.item);

        const res = await axiosInstance.post('/cart/details-by-ids', {
          productIds,
          collectionIds
        });

        const { products, collections } = res.data;
        const productMap = new Map(products.map(p => [p._id, p]));
        const collectionMap = new Map(collections.map(c => [c._id, c]));

        const detailed = cart.map(cartItem => {
          const details = cartItem.itemType === 'Product'
            ? productMap.get(cartItem.item)
            : collectionMap.get(cartItem.item);

          if (!details) return null;

          return {
            ...cartItem,
            name: details.name,
            imageUrl: details.images?.[0],
            price: details.discountedPrice || details.price
          };
        }).filter(Boolean);

        setDetailedCartItems(detailed);

        const total = detailed.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setSubtotal(total);
      } catch (error) {
        console.error('Error fetching cart details:', error);
        toast.error('Failed to load cart details');
      }
    };

    fetchCartDetails();
  }, [cart, navigate]);

  // Validate coupon when cart changes
  useEffect(() => {
    if (appliedCoupon && detailedCartItems.length > 0) {
      validateCoupon(
        detailedCartItems.map(item => ({
          item: item.item,
          itemType: item.itemType,
          quantity: item.quantity
        })),
        subtotal
      );
    }
  }, [detailedCartItems, subtotal]);

  // Calculate tax when address or cart changes
  useEffect(() => {
    const shouldCalculate =
      shippingAddress.address &&
      shippingAddress.city &&
      shippingAddress.state &&
      shippingAddress.postalCode &&
      shippingAddress.country &&
      detailedCartItems.length > 0;

    if (!shouldCalculate) {
      setTaxAmount(0);
      return;
    }

    const calculateTax = async () => {
      setIsCalculatingTax(true);
      try {
        const payload = {
          items: detailedCartItems.map((item) => ({
            id: item.item,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
          shippingAddress: {
            address: shippingAddress.address,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: shippingAddress.country,
            postalCode: shippingAddress.postalCode,
          },
          amount: subtotal - discount + shippingCost,
          shippingCost,
          currency: 'NGN',
        };

        const res = await axiosInstance.post('/taxes/calculate', payload);
        const calculatedTax = res.data?.tax?.amountToCollect || 0;
        setTaxAmount(calculatedTax);
      } catch (error) {
        console.error('Tax calculation error:', error);
        setTaxAmount(0);
        toast.error('Tax estimate unavailable. Proceeding without tax.');
      } finally {
        setIsCalculatingTax(false);
      }
    };

    const timeoutId = setTimeout(() => {
      calculateTax();
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.postalCode,
    shippingAddress.country,
    detailedCartItems,
    subtotal,
    discount,
    shippingCost,
  ]);

  const finalTotal = subtotal - discount + shippingCost + taxAmount;

  const handleInputChange = (e, addressType) => {
    const { name, value } = e.target;
    if (addressType === 'shipping') {
      setShippingAddress(prev => ({ ...prev, [name]: value }));
    } else {
      setBillingAddress(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    try {
      const orderData = {
        items: detailedCartItems.map(item => ({
          item: item.item,
          itemType: item.itemType,
          quantity: item.quantity
        })),
        shippingAddress,
        billingAddress: useSameAddressForBilling ? shippingAddress : billingAddress,
        useSameAddressForBilling,
        couponCode: appliedCoupon?.code || null,
        shippingCost,
        taxAmount,
        notes,
        paymentMethod
      };

      const order = await createOrder(orderData);

      toast.success('Order created successfully!');

      // Remove coupon
      removeCoupon();

      if (paymentMethod === 'paystack') {
        const response = await axiosInstance.post('/payments/paystack/initialize', {
          orderId: order._id
        });

        if (response.data?.authorizationUrl) {
          window.location.href = response.data.authorizationUrl;
          return;
        }

        toast.error('Failed to initialize Paystack payment');
        return;
      }

      if (paymentMethod === 'download_invoice') {
        try {
          const response = await axiosInstance.get(`/orders/${order._id}/invoice`, {
            responseType: 'blob'
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `invoice-${order.orderNumber}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('Invoice downloaded');
        } catch (dlErr) {
          console.error('Invoice download error:', dlErr);
          toast.error('Failed to download invoice');
        }
      }

      // Redirect to order confirmation
      navigate(`/order-confirmation/${order._id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.message || 'Failed to create order');
    }
  };

  const nigerianStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  ];

  if (detailedCartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <PageWrapper>
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-neutral mb-8">Checkout</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Shipping Address */}
              <div className="card bg-white rounded-none border border-base-300">
                <div className="card-body">
                  <h2 className="card-title flex items-center gap-2">
                    {/* <Truck size={20} /> */}
                    Shipping Address
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="form-control flex flex-col">
                      <label className="label">
                        <span className="label-text">Full Name *</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        className="input input-bordered rounded-none w-full"
                        value={shippingAddress.fullName}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      />
                    </div>

                    <div className="form-control flex flex-col">
                      <label className="label">
                        <span className="label-text">Phone Number *</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        className="input input-bordered rounded-none w-full"
                        value={shippingAddress.phone}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      />
                    </div>

                    <div className="form-control flex flex-col md:col-span-2">
                      <label className="label">
                        <span className="label-text">Email *</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        className="input input-bordered rounded-none w-full"
                        value={shippingAddress.email}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      />
                    </div>

                    <div className="form-control flex flex-col md:col-span-2">
                      <label className="label">
                        <span className="label-text">Address *</span>
                      </label>
                      <textarea
                        name="address"
                        className="textarea textarea-bordered rounded-none w-full"
                        rows="2"
                        value={shippingAddress.address}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      />
                    </div>

                    <div className="form-control flex flex-col">
                      <label className="label">
                        <span className="label-text">City *</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        className="input input-bordered rounded-none w-full"
                        value={shippingAddress.city}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      />
                    </div>

                    <div className="form-control flex flex-col">
                      <label className="label">
                        <span className="label-text">State *</span>
                      </label>
                      <select
                        name="state"
                        className="select select-bordered rounded-none w-full"
                        value={shippingAddress.state}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                        required
                      >
                        <option value="">Select State</option>
                        {nigerianStates.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control flex flex-col">
                      <label className="label">
                        <span className="label-text">Postal Code</span>
                      </label>
                      <input
                        type="text"
                        name="postalCode"
                        className="input input-bordered rounded-none w-full"
                        value={shippingAddress.postalCode}
                        onChange={(e) => handleInputChange(e, 'shipping')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Address Toggle */}
              <div className="form-control flex flex-col">
                <label className="label cursor-pointer justify-start gap-4">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={useSameAddressForBilling}
                    onChange={(e) => setUseSameAddressForBilling(e.target.checked)}
                  />
                  <span className="label-text">Billing address same as shipping</span>
                </label>
              </div>

              {/* Billing Address (if different) */}
              {!useSameAddressForBilling && (
                <div className="card bg-white border border-base-300">
                  <div className="card-body">
                    <h2 className="card-title">Billing Address</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Same fields as shipping */}
                      <div className="form-control flex flex-col">
                        <label className="label">
                          <span className="label-text">Full Name *</span>
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          className="input input-bordered rounded-none w-full"
                          value={billingAddress.fullName}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        />
                      </div>

                      <div className="form-control flex flex-col">
                        <label className="label">
                          <span className="label-text">Phone Number *</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          className="input input-bordered rounded-none w-full"
                          value={billingAddress.phone}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        />
                      </div>

                      <div className="form-control md:col-span-2 flex flex-col">
                        <label className="label">
                          <span className="label-text">Email *</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          className="input input-bordered rounded-none w-full"
                          value={billingAddress.email}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        />
                      </div>

                      <div className="form-control md:col-span-2 flex flex-col">
                        <label className="label">
                          <span className="label-text">Address *</span>
                        </label>
                        <textarea
                          name="address"
                          className="textarea textarea-bordered rounded-none w-full"
                          rows="2"
                          value={billingAddress.address}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        />
                      </div>

                      <div className="form-control flex flex-col">
                        <label className="label">
                          <span className="label-text">City *</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          className="input input-bordered rounded-none w-full"
                          value={billingAddress.city}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        />
                      </div>

                      <div className="form-control flex flex-col">
                        <label className="label">
                          <span className="label-text">State *</span>
                        </label>
                        <select
                          name="state"
                          className="select select-bordered rounded-none w-full"
                          value={billingAddress.state}
                          onChange={(e) => handleInputChange(e, 'billing')}
                          required={!useSameAddressForBilling}
                        >
                          <option value="">Select State</option>
                          {nigerianStates.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              <div className="card bg-white border border-base-300">
                <div className="card-body">
                  <h2 className="card-title">Order Notes (Optional)</h2>
                  <textarea
                    className="textarea textarea-bordered rounded-none w-full mt-4"
                    rows="3"
                    placeholder="Add any special instructions for your order..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="card bg-white border rounded-none border-base-300 sticky top-24">
                <div className="card-body">
                  <h2 className="card-title flex items-center gap-2">
                    {/* <ShoppingBag size={20} /> */}
                    Order Summary
                  </h2>

                  {/* Items */}
                  <div className="space-y-3 mt-4">
                    {detailedCartItems.map(item => (
                      <div key={item._id} className="flex gap-3">
                        <img
                          src={item.imageUrl || 'https://placehold.co/60x60'}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-neutral/60">Qty: {item.quantity}</p>
                          <p className="text-sm font-semibold">
                            ₦{(item.price * item.quantity).toLocaleString('en-NG', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="divider"></div>

                  {/* Pricing */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({appliedCoupon?.code})</span>
                        <span>-₦{discount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="text-green-600">{shippingCost === 0 ? 'FREE' : `₦${shippingCost.toLocaleString('en-NG')}`}</span>
                    </div>

                    {taxAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>₦{taxAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {isCalculatingTax && (
                      <div className="flex justify-between text-sm text-neutral/60">
                        <span>Calculating tax...</span>
                        <span>—</span>
                      </div>
                    )}
                  </div>

                  <div className="divider"></div>

                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>₦{finalTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Payment Method */}
                  <div className="form-control mt-4">
                    <label className="label">
                      <span className="label-text font-medium flex items-center gap-2">
                        <CreditCard size={16} />
                        Payment Method
                      </span>
                    </label>
                    <select
                      className="select select-bordered rounded-none w-full"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="whatsapp">WhatsApp Order</option>
                      <option value="paystack">Paystack (Card/Bank)</option>
                      <option value="download_invoice">Download Invoice</option>
                    </select>
                  </div>



                  {/* Terms */}
                  <div className="form-control mt-4">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm rounded-none"
                        checked={agreeToTerms}
                        onChange={(e) => setAgreeToTerms(e.target.checked)}
                        required
                      />
                      <span className="label-text text-xs">
                        I agree to the terms and conditions
                      </span>
                    </label>
                  </div>

                  {/* Place Order Button */}
                  <button
                    type="submit"
                    className="btn btn-primary rounded-none w-full mt-4"
                    disabled={isCreatingOrder || !agreeToTerms}
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Processing...
                      </>
                    ) : (
                      <>
                        {/* <CheckCircle size={20} /> */}
                        Place Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
    </PageWrapper>
  );
};

export default CheckoutPage;
