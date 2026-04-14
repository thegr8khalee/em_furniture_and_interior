import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrderStore } from '../store/useOrderStore';
import { Package, Truck, CheckCircle, XCircle, Clock, Loader2, ShoppingBag, Download } from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { toast } from 'react-hot-toast';
import { PageWrapper } from '../components/animations';

const OrderHistoryPage = () => {
  const { orders, getMyOrders, isLoading } = useOrderStore();

  useEffect(() => {
    getMyOrders();
  }, [getMyOrders]);

  const downloadInvoice = async (orderId, orderNumber) => {
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error(error);
    }
  };

  const downloadReceipt = async (orderId, orderNumber) => {
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/receipt`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const downloadQuotation = async (orderId, orderNumber) => {
    try {
      const response = await axiosInstance.get(`/orders/${orderId}/quotation`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Quotation downloaded');
    } catch (error) {
      toast.error('Failed to download quotation');
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock size={20} className="text-warning" />,
      confirmed: <Package size={20} className="text-info" />,
      processing: <Package size={20} className="text-info" />,
      shipped: <Truck size={20} className="text-primary" />,
      delivered: <CheckCircle size={20} className="text-success" />,
      cancelled: <XCircle size={20} className="text-error" />,
      refunded: <XCircle size={20} className="text-error" />
    };
    return icons[status] || <Package size={20} />;
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <PageWrapper>
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral">My Orders</h1>
            <p className="text-neutral/60 mt-1">Track and manage your orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="card bg-white border border-base-300">
            <div className="card-body text-center py-16">
              <ShoppingBag size={64} className="mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
              <p className="text-neutral/60 mb-6">Start shopping and your orders will appear here</p>
              <Link to="/shop" className="btn btn-primary">
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="card bg-white border border-base-300 hover:shadow-lg transition-shadow">
                <div className="card-body">
                  {/* Order Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-base-200">
                    <div>
                      <p className="text-sm text-neutral/60">Order Number</p>
                      <p className="font-mono font-bold">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral/60">Order Date</p>
                      <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral/60">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(order.status)}
                        <span className={`badge ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-neutral/60">Total</p>
                      <p className="font-bold text-lg">
                        ₦{order.totalAmount.toLocaleString('en-NG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="py-4">
                    <p className="text-sm text-neutral/60 mb-3">Items ({order.items.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {order.items.slice(0, 4).map((item, index) => (
                        <div key={index} className="relative">
                          <img
                            src={item.imageUrl || 'https://placehold.co/60x60'}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded border border-base-200"
                          />
                          {item.quantity > 1 && (
                            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {item.quantity}
                            </span>
                          )}
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <div className="w-16 h-16 rounded border border-base-200 flex items-center justify-center bg-base-200">
                          <span className="text-sm font-semibold">+{order.items.length - 4}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tracking Info */}
                  {order.trackingNumber && (
                    <div className="py-4 border-t border-base-200">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-primary" />
                        <div>
                          <p className="text-sm font-medium">Tracking: {order.trackingNumber}</p>
                          {order.carrier && <p className="text-xs text-neutral/60">Carrier: {order.carrier}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-base-200">
                    <Link
                      to={`/order-confirmation/${order._id}`}
                      className="btn btn-sm btn-primary"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => downloadInvoice(order._id, order.orderNumber)}
                      className="btn btn-xs btn-outline"
                    >
                      Invoice
                    </button>
                    {order.paymentStatus === 'paid' && (
                      <button
                        onClick={() => downloadReceipt(order._id, order.orderNumber)}
                        className="btn btn-xs btn-outline"
                      >
                        Receipt
                      </button>
                    )}
                    <button
                      onClick={() => downloadQuotation(order._id, order.orderNumber)}
                      className="btn btn-xs btn-outline"
                    >
                      Quotation
                    </button>
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        Track Package
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default OrderHistoryPage;
