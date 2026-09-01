import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/useOrderStore';
import { CheckCircle, Package, Truck, MapPin, CreditCard, Loader2, Download } from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { toast } from 'react-hot-toast';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentOrder, getOrderById, isLoading } = useOrderStore();
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        await getOrderById(orderId);
      } catch (err) {
        setError('Order not found or you do not have permission to view it');
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, getOrderById]);

  const downloadInvoice = async () => {
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${currentOrder.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/receipt`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${currentOrder.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error('Failed to download receipt');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadQuotation = async () => {
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/quotation`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${currentOrder.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Quotation downloaded');
    } catch (error) {
      toast.error('Failed to download quotation');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (error || !currentOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-error text-lg mb-4">{error || 'Order not found'}</p>
          <Link to="/shop" className="btn btn-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'badge-warning',
      confirmed: 'badge-info',
      processing: 'badge-info',
      shipped: 'badge-primary',
      delivered: 'badge-success',
      cancelled: 'badge-error',
      refunded: 'badge-error'
    };
    return colors[status] || 'badge-ghost';
  };

  const getStatusIcon = (status) => {
    if (status === 'delivered') return <CheckCircle size={24} />;
    if (status === 'shipped') return <Truck size={24} />;
    if (status === 'processing' || status === 'confirmed') return <Package size={24} />;
    return <Package size={24} />;
  };

  return (
    <PageWrapper>
    <SEO title="Order Confirmation" description="Your order has been confirmed." noindex />
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-success text-white rounded-full mb-4">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-3xl font-bold text-neutral mb-2">Order Placed Successfully!</h1>
          <p className="text-neutral/60">
            Your order number is <span className="font-mono font-bold">{currentOrder.orderNumber}</span>
          </p>
        </div>

        {/* Order Status */}
        <div className="card bg-white border border-base-300 mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-primary">
                  {getStatusIcon(currentOrder.status)}
                </div>
                <div>
                  <h3 className="font-semibold">Order Status</h3>
                  <p className="text-sm text-neutral/60">
                    <span className={`badge ${getStatusColor(currentOrder.status)} badge-sm`}>
                      {currentOrder.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-neutral/60">Order Date</p>
                <p className="font-semibold">{new Date(currentOrder.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {currentOrder.trackingNumber && (
              <div className="mt-4 p-4 bg-base-200 rounded">
                <p className="text-sm font-medium mb-1">Tracking Number</p>
                <p className="font-mono">{currentOrder.trackingNumber}</p>
                {currentOrder.trackingUrl && (
                  <a
                    href={currentOrder.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-link p-0 mt-2"
                  >
                    Track Package →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Shipping Address */}
          <div className="card bg-white border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-base flex items-center gap-2">
                <MapPin size={18} />
                Shipping Address
              </h3>
              <div className="text-sm space-y-1 mt-2">
                <p className="font-semibold">{currentOrder.shippingAddress.fullName}</p>
                <p>{currentOrder.shippingAddress.address}</p>
                <p>{currentOrder.shippingAddress.city}, {currentOrder.shippingAddress.state}</p>
                <p>{currentOrder.shippingAddress.country}</p>
                <p className="text-neutral/60">Phone: {currentOrder.shippingAddress.phone}</p>
                <p className="text-neutral/60">Email: {currentOrder.shippingAddress.email}</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="card bg-white border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-base flex items-center gap-2">
                <CreditCard size={18} />
                Payment Information
              </h3>
              <div className="text-sm space-y-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-neutral/60">Method:</span>
                  <span className="font-semibold capitalize">{currentOrder.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral/60">Status:</span>
                  <span className={`badge badge-sm ${
                    currentOrder.paymentStatus === 'paid' ? 'badge-success' :
                    currentOrder.paymentStatus === 'pending' ? 'badge-warning' :
                    'badge-error'
                  }`}>
                    {currentOrder.paymentStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="card bg-white border border-base-300 mb-6">
          <div className="card-body">
            <h3 className="card-title text-base mb-4">Order Items</h3>
            <div className="space-y-4">
              {currentOrder.items.map((item, index) => (
                <div key={index} className="flex gap-4 pb-4 border-b border-base-200 last:border-b-0">
                  <img
                    src={item.imageUrl || 'https://placehold.co/80x80'}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.name}</h4>
                    <p className="text-sm text-neutral/60">Quantity: {item.quantity}</p>
                    <p className="text-sm font-semibold mt-1">
                      ₦{item.subtotal.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="divider"></div>

            {/* Price Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₦{currentOrder.subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>

              {currentOrder.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount {currentOrder.couponCode && `(${currentOrder.couponCode})`}</span>
                  <span>-₦{currentOrder.discount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{currentOrder.shippingCost === 0 ? 'FREE' : `₦${currentOrder.shippingCost.toLocaleString('en-NG')}`}</span>
              </div>

              {currentOrder.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>₦{currentOrder.taxAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="divider my-2"></div>

              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>₦{currentOrder.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Notes */}
        {currentOrder.notes && (
          <div className="card bg-white border border-base-300 mb-6">
            <div className="card-body">
              <h3 className="card-title text-base">Order Notes</h3>
              <p className="text-sm text-neutral/70">{currentOrder.notes}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          {currentOrder.paymentStatus === 'paid' ? (
            <button
              className={`btn btn-outline ${isDownloading ? 'loading' : ''}`}
              onClick={downloadReceipt}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Download size={20} />
              )}
              Download Receipt
            </button>
          ) : (
            <>
              <button
                onClick={downloadInvoice}
                className="btn btn-outline"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Download size={20} />
                )}
                Download Invoice
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default OrderConfirmationPage;
