import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  Search, 
  Download, 
  Eye, 
  Edit2, 
  Undo2,
  Banknote,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Pagination, Select, SkeletonBlock } from '@em/ui';

const OrderManagement = () => {
  const navigate = useNavigate();
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
  const [refundForm, setRefundForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);

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

  /**
   * Money in, recorded by hand.
   *
   * A transfer, cash in the workshop, or a deposit taken before anything is
   * built — which for bespoke furniture is the usual way round. The operator
   * records that money arrived; whether it lands as a deposit owed back or as
   * settlement of what the customer owes is the posting rule's decision, made
   * from whether the sale has been recognised yet.
   */
  const submitPayment = async (event) => {
    event.preventDefault();
    setIsUpdating(true);

    try {
      const { data } = await axiosInstance.post(
        `/orders/admin/${paymentForm.order._id}/payments`,
        {
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference || null,
        }
      );
      toast.success(data.message);
      setPaymentForm(null);
      fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not record that payment');
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Giving money back.
   *
   * Deliberately not a status change. Setting an order to "refunded" on the
   * dropdown used to be a word on a screen — the revenue stayed recognised, the
   * cash stayed in the bank, the VAT stayed owed and the goods never came back.
   * `refunded` has been taken off both dropdowns for that reason: the only way
   * to reach it is this, which posts.
   */
  const openRefund = async (order) => {
    setRefundForm({ order, loading: true });

    try {
      const { data } = await axiosInstance.get(`/orders/admin/${order._id}/refunds`);
      setRefundForm({
        order,
        refundable: data.refundable,
        refunded: data.refunded,
        refunds: data.refunds,
        amount: String(data.refundable),
        reason: '',
        restock: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load refunds for that order');
      setRefundForm(null);
    }
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    setIsUpdating(true);

    try {
      const { data } = await axiosInstance.post(
        `/orders/admin/${refundForm.order._id}/refunds`,
        {
          amount: Number(refundForm.amount),
          reason: refundForm.reason,
          restock: refundForm.restock,
        }
      );
      toast.success(data.message);
      setRefundForm(null);
      fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not refund that order');
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

  const hasFilters = Boolean(searchQuery || filterStatus || filterPaymentStatus);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('');
    setFilterPaymentStatus('');
    setCurrentPage(1);
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
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="Nothing matched"
            description="No order matches that search and those filters. The filters are still on — clearing them brings the rest back."
            actionLabel="Clear the filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Orders placed on the website land here. A sale made in the showroom or over WhatsApp has to be written down — that is what the counter is for."
            actionLabel="Record a sale"
            actionTo="/admin/sales/new"
          />
        )
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
                  <tr
                    key={order._id}
                    className="hover cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${order._id}`)}
                  >
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
                    <td onClick={(event) => event.stopPropagation()}>
                      <select
                        className="w-full border border-base-300 bg-white px-2 py-1 text-xs text-neutral transition-colors duration-300 focus:border-secondary focus:outline-none"
                        value={order.paymentStatus}
                        onChange={(e) => handlePaymentStatusUpdate(order._id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        {/* No "refunded" here. It moved the word and nothing
                            else; the Refund action posts. */}
                        {order.paymentStatus === 'refunded' && (
                          <option value="refunded">Refunded</option>
                        )}
                      </select>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openStatusModal(order)} title="Update Status">
                          <Edit2 size={14} />
                        </Button>
                        {order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Record a payment"
                            onClick={() =>
                              setPaymentForm({
                                order,
                                amount: '',
                                method: 'bank_transfer',
                                reference: '',
                              })
                            }
                          >
                            <Banknote size={14} />
                          </Button>
                        )}
                        {order.paymentStatus === 'paid' && (
                          <Button variant="ghost" size="sm" onClick={() => openRefund(order)} title="Refund">
                            <Undo2 size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => downloadInvoice(order._id)} title="Download Invoice">
                          <Download size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadReceipt(order._id)} title="Download Receipt">
                          <Download size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadQuotation(order._id)} title="Download Quotation">
                          <Download size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/orders/${order._id}`)}
                          title="Open this order"
                        >
                          <Eye size={14} />
                        </Button>
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

      {/* Record a payment */}
      <Modal
        isOpen={Boolean(paymentForm)}
        onClose={() => setPaymentForm(null)}
        title={`Record a payment — ${paymentForm?.order?.orderNumber || ''}`}
        className="max-w-lg"
      >
        {paymentForm && (
          <form onSubmit={submitPayment} className="space-y-4">
            <p className="text-sm text-neutral/60">
              {paymentForm.order.status === 'pending'
                ? 'This order has not been confirmed, so the money is held as a deposit — owed back until the goods are delivered.'
                : 'This settles what the customer owes on the order.'}{' '}
              The order is worth ₦{Number(paymentForm.order.totalAmount).toLocaleString()}.
            </p>

            <Input
              label="Amount (₦)"
              type="number"
              min="0"
              step="0.01"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />

            <Select
              label="How it arrived"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash_on_delivery">Cash</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>

            <Input
              label="Reference (optional)"
              placeholder="Teller number, transfer reference"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPaymentForm(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUpdating}>
                Record
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal
        isOpen={Boolean(refundForm)}
        onClose={() => setRefundForm(null)}
        title={`Refund ${refundForm?.order?.orderNumber || ''}`}
        className="max-w-lg"
      >
        {refundForm?.loading ? (
          <SkeletonBlock className="h-40 w-full" />
        ) : refundForm ? (
          <form onSubmit={submitRefund} className="space-y-4">
            <p className="text-sm text-neutral/60">
              This takes the revenue and the VAT back out of the books and the cash out of the
              account it was paid into. ₦{Number(refundForm.refundable).toLocaleString()} is left to
              refund
              {refundForm.refunded > 0 &&
                ` — ₦${Number(refundForm.refunded).toLocaleString()} already given back`}
              .
            </p>

            <Input
              label="Amount (₦)"
              type="number"
              min="0"
              step="0.01"
              required
              value={refundForm.amount}
              onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
            />

            <Input
              label="Reason"
              required
              placeholder="Arrived damaged"
              hint="The first thing anyone asks about a refund later"
              value={refundForm.reason}
              onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
            />

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm mt-1"
                checked={refundForm.restock}
                disabled={Number(refundForm.amount) !== Number(refundForm.refundable)}
                onChange={(e) => setRefundForm({ ...refundForm, restock: e.target.checked })}
              />
              <span className="text-sm text-neutral">
                The goods came back
                <span className="block text-xs text-neutral/50">
                  Returns them to stock and reverses the cost of sale. Full refunds only — picking
                  which lines came back out of a partial one would be a guess.
                </span>
              </span>
            </label>

            {refundForm.refunds?.length > 0 && (
              <div className="border-t border-base-300 pt-3">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                  Already refunded
                </span>
                <ul className="space-y-1 text-sm text-neutral/60">
                  {refundForm.refunds.map((refund) => (
                    <li key={refund._id} className="flex justify-between gap-4">
                      <span>
                        {refund.refundedOn} · {refund.reason}
                        {refund.restocked && ' · restocked'}
                      </span>
                      <span className="font-mono">₦{Number(refund.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setRefundForm(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isUpdating}>
                Refund
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

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
            {/* Refunding is its own action, because it has to post. */}
            {selectedOrder?.status === 'refunded' && (
              <option value="refunded">Refunded</option>
            )}
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
