import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Search, 
  Download, 
  Eye, 
  Edit2, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock,
  Loader2
} from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import { SkeletonBlock } from '../../components/ui/Skeleton';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Status update form
  const [statusForm, setStatusForm] = useState({
    status: '',
    note: '',
    trackingNumber: '',
    trackingUrl: '',
    carrier: '',
    estimatedDeliveryDate: ''
  });

  useEffect(() => {
    fetchOrders();
  }, [currentPage, filterStatus, filterPaymentStatus, searchQuery]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });

      if (filterStatus) params.append('status', filterStatus);
      if (filterPaymentStatus) params.append('paymentStatus', filterPaymentStatus);
      if (searchQuery) params.append('search', searchQuery);

      const response = await axiosInstance.get(`/orders/admin/all?${params}`);
      setOrders(response.data.orders);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load orders');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openStatusModal = (order) => {
    setSelectedOrder(order);
    setStatusForm({
      status: order.status,
      note: '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
      carrier: order.carrier || '',
      estimatedDeliveryDate: order.estimatedDeliveryDate 
        ? new Date(order.estimatedDeliveryDate).toISOString().split('T')[0] 
        : ''
    });
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await axiosInstance.put(`/orders/admin/${selectedOrder._id}/status`, statusForm);
      toast.success('Order updated successfully');
      setShowStatusModal(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentStatusUpdate = async (orderId, newStatus) => {
    try {
      await axiosInstance.put(`/orders/admin/${orderId}/payment`, {
        paymentStatus: newStatus,
        note: `Payment status changed to ${newStatus}`
      });
      toast.success('Payment status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

  const downloadInvoice = async (orderId) => {
    try {
      const response = await axiosInstance.get(`/orders/admin/${orderId}/invoice`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };

  const downloadReceipt = async (orderId) => {
    try {
      const response = await axiosInstance.get(`/orders/admin/${orderId}/receipt`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Receipt downloaded');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const downloadQuotation = async (orderId) => {
    try {
      const response = await axiosInstance.get(`/orders/admin/${orderId}/quotation`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${orderId}.pdf`);
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
      pending: <Clock size={16} className="text-warning" />,
      confirmed: <Package size={16} className="text-info" />,
      processing: <Package size={16} className="text-info" />,
      shipped: <Truck size={16} className="text-primary" />,
      delivered: <CheckCircle size={16} className="text-success" />,
      cancelled: <XCircle size={16} className="text-error" />,
      refunded: <XCircle size={16} className="text-error" />
    };
    return icons[status] || <Package size={16} />;
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

  const getPaymentStatusColor = (status) => {
    const colors = {
      pending: 'badge-warning',
      paid: 'badge-success',
      failed: 'badge-error',
      refunded: 'badge-error'
    };
    return colors[status] || 'badge-ghost';
  };

  return (
    <AdminPageShell title="Order Management" subtitle="Manage and track customer orders">

      {/* Filters and Search */}
      <div className="border border-base-300 bg-white p-5">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <Input
              name="search"
              placeholder="Search by order number, name, or email..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-auto"
          >
            <option value="">All Order Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </Select>

          <Select
            value={filterPaymentStatus}
            onChange={(e) => {
              setFilterPaymentStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-auto"
          >
            <option value="">All Payment Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Order Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <span className="font-mono text-sm font-semibold">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p className="font-semibold">{order.shippingAddress.fullName}</p>
                        <p className="text-xs text-neutral/60">{order.shippingAddress.email}</p>
                        {order.isGuestOrder && (
                          <span className="badge badge-xs badge-ghost">Guest</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm">{order.items.length} item(s)</span>
                    </td>
                    <td>
                      <span className="font-semibold">
                        ₦{order.totalAmount.toLocaleString('en-NG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className={`badge badge-sm ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="w-full border border-base-300 bg-white px-2 py-1 text-xs text-neutral transition-colors duration-300 focus:border-secondary focus:outline-none"
                        value={order.paymentStatus}
                        onChange={(e) => handlePaymentStatusUpdate(order._id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openStatusModal(order)} title="Update Status">
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadInvoice(order._id)} title="Download Invoice">
                          <Download size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadReceipt(order._id)} title="Download Receipt">
                          <Download size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadQuotation(order._id)} title="Download Quotation">
                          <Download size={14} />
                        </Button>
                        <Link
                          to={`/order-confirmation/${order._id}`}
                          className="inline-flex items-center justify-center border border-transparent px-3 py-1.5 text-sm text-neutral/70 transition-colors hover:bg-base-200"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </>
      )}

      {/* Status Update Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title={`Update Order Status - ${selectedOrder?.orderNumber || ''}`}>
        <form onSubmit={handleStatusUpdate} className="space-y-4">
          <Select label="Order Status" name="status" value={statusForm.status} onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))} required>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Tracking Number" value={statusForm.trackingNumber} onChange={(e) => setStatusForm(prev => ({ ...prev, trackingNumber: e.target.value }))} />
            <Input label="Carrier" placeholder="e.g., DHL, FedEx" value={statusForm.carrier} onChange={(e) => setStatusForm(prev => ({ ...prev, carrier: e.target.value }))} />
          </div>

          <Input label="Tracking URL" type="url" placeholder="https://..." value={statusForm.trackingUrl} onChange={(e) => setStatusForm(prev => ({ ...prev, trackingUrl: e.target.value }))} />
          <Input label="Estimated Delivery Date" type="date" value={statusForm.estimatedDeliveryDate} onChange={(e) => setStatusForm(prev => ({ ...prev, estimatedDeliveryDate: e.target.value }))} />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">Note (Optional)</label>
            <textarea className="w-full border border-base-300 bg-white px-4 py-3 text-sm text-neutral transition-colors duration-300 placeholder:text-neutral/40 focus:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30" rows={3} placeholder="Add notes about this status update..." value={statusForm.note} onChange={(e) => setStatusForm(prev => ({ ...prev, note: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowStatusModal(false)} disabled={isUpdating}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isUpdating}>Update</Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  );
};

export default OrderManagement;
