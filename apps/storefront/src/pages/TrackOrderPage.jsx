import React, { useState } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { Search, Package, Truck, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageWrapper } from '../components/animations';
import SEO from '../components/SEO';

const TrackOrderPage = () => {
  const { trackOrder, isLoading } = useOrderStore();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await trackOrder(orderNumber.trim(), email.trim());
      setOrder(result);
      toast.success('Order found');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Order not found');
      setOrder(null);
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

  return (
    <PageWrapper>
    <SEO title="Track Your Order" description="Track the status of your order." canonical="/track-order" noindex />
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral">Track Your Order</h1>
          <p className="text-neutral/60 mt-2">Enter your order number and email to view status</p>
        </div>

        <div className="card bg-white border border-base-300 mb-8">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Order Number</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="ORD-XXXXXXXX-XXX"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email Address</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Search size={20} />
                )}
                Track Order
              </button>
            </form>
          </div>
        </div>

        {order && (
          <div className="card bg-white border border-base-300">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-neutral/60">Order Number</p>
                  <p className="font-mono font-bold">{order.orderNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(order.status)}
                  <span className="badge badge-outline">{order.status.toUpperCase()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral/60">Order Date</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral/60">Total</span>
                  <span className="font-semibold">
                    ₦{order.totalAmount.toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                {order.trackingNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral/60">Tracking</span>
                    <span className="font-mono">{order.trackingNumber}</span>
                  </div>
                )}
              </div>

              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm mt-4"
                >
                  Track Package
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </PageWrapper>
  );
};

export default TrackOrderPage;
