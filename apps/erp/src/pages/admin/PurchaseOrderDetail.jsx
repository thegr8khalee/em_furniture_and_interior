import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Download, PackageCheck, Send, Truck, XCircle } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * One purchase order, on a page of its own.
 *
 * A purchase order is the only document in the system that turns into two
 * things at once — stock on a shelf and money owed to somebody — and it lived
 * as a row in a tab with its lines folded away. Receiving one is the moment
 * both of those happen, which is worth being able to look at properly first.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');

const STATUS = { draft: 'neutral', sent: 'info', received: 'warning', cancelled: 'error' };

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash_on_delivery', label: 'Cash' },
];

const Section = ({ title, icon: Icon, action, children }) => (
  <section className="border border-base-300 bg-white p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/60">
        {Icon && <Icon size={14} />}
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const PurchaseOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [payForm, setPayForm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data } = await axiosInstance.get(`/purchasing/purchase-orders/${orderId}`);
      setOrder(data.purchaseOrder);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that order');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = (path, message, confirmation) => async () => {
    if (confirmation && !window.confirm(confirmation)) return;
    setIsSaving(true);

    try {
      await axiosInstance.post(`/purchasing/purchase-orders/${orderId}/${path}`);
      toast.success(message);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'That did not work');
    } finally {
      setIsSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.post(`/purchasing/purchase-orders/${orderId}/pay`, payForm);
      toast.success('Paid, and the payable is cleared.');
      setPayForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not record that payment');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const { data } = await axiosInstance.get(`/purchasing/purchase-orders/${orderId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `purchase-order-${order.poNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download purchase order PDF');
    }
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Loading…">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <SkeletonBlock key={index} className="h-24 w-full" />
          ))}
        </div>
        <SkeletonBlock className="h-80 w-full" />
      </AdminPageShell>
    );
  }

  if (!order) {
    return (
      <AdminPageShell title="Purchase order not found">
        <EmptyState
          icon={Truck}
          title="No order with that id"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to purchasing"
          actionTo="/admin/purchasing"
        />
      </AdminPageShell>
    );
  }

  const isDraft = order.status === 'draft';
  const isOpen = isDraft || order.status === 'sent';
  const owes = order.status === 'received' && !order.paidOn;

  return (
    <AdminPageShell
      title={order.poNumber}
      subtitle={`Raised ${day(order.createdAt)} with ${order.vendor.name}`}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/purchasing">
            All purchasing
          </Button>
          <Button variant="ghost" leftIcon={Download} onClick={downloadPdf}>
            Download PDF
          </Button>
          {isDraft && (
            <Button
              variant="ghost"
              leftIcon={Send}
              onClick={act('send', 'Marked as sent')}
              isLoading={isSaving}
            >
              Mark sent
            </Button>
          )}
          {isOpen && (
            <Button
              leftIcon={PackageCheck}
              onClick={act(
                'receive',
                'Received — stock is in and the payable is raised',
                `Receive ${order.poNumber}? This brings the stock in and raises what is owed.`
              )}
              isLoading={isSaving}
            >
              Receive
            </Button>
          )}
          {owes && (
            <Button
              onClick={() =>
                setPayForm({
                  paymentMethod: 'bank_transfer',
                  paidOn: new Date().toISOString().slice(0, 10),
                })
              }
            >
              Pay
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Status
          </p>
          <div className="mt-2">
            <Badge variant={STATUS[order.status]}>{order.status}</Badge>
          </div>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">Total</p>
          <p className="mt-2 font-heading text-2xl font-bold text-neutral">{naira(order.total)}</p>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Expected
          </p>
          <p className="mt-2 font-heading text-2xl font-bold text-neutral">
            {day(order.expectedOn)}
          </p>
          {order.receivedOn && (
            <p className="mt-1 text-xs text-neutral/40">Received {day(order.receivedOn)}</p>
          )}
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">Paid</p>
          <p className="mt-2 font-heading text-2xl font-bold text-neutral">
            {order.paidOn ? day(order.paidOn) : '—'}
          </p>
          <p className="mt-1 text-xs text-neutral/40">
            {order.paidOn ? order.paymentMethod : owes ? 'Owed to the vendor' : 'Nothing owed yet'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title={`Lines (${order.items.length})`} icon={Truck}>
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit cost</th>
                    <th className="text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((line) => (
                    <tr
                      key={line._id}
                      className="hover cursor-pointer"
                      onClick={() => navigate(`/admin/products/${line.product}`)}
                    >
                      <td>{line.name}</td>
                      <td className="text-right">{line.quantity}</td>
                      <td className="text-right font-mono tabular-nums">{naira(line.unitCost)}</td>
                      <td className="text-right font-mono tabular-nums">{naira(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t-2 border-neutral pt-3">
              <span className="font-heading text-lg font-bold text-neutral">Total</span>
              <span className="font-mono text-xl font-bold">{naira(order.total)}</span>
            </div>

            {/* The cost on the movement is the cost that was ordered, not the
                product's current cost price: what the business owes is what it
                agreed to pay. */}
            {isOpen && (
              <p className="mt-4 text-xs text-neutral/50">
                Receiving this writes one stock movement per line at the cost agreed here, and
                raises the same amount as a payable.
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Vendor" icon={Building2}>
            <p className="font-medium">{order.vendor.name}</p>
            <Button
              variant="ghost"
              className="mt-3 px-0"
              onClick={() => navigate(`/admin/purchasing/vendors/${order.vendor._id}`)}
            >
              Open their record
            </Button>
          </Section>

          {order.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-sm text-neutral/70">{order.notes}</p>
            </Section>
          )}

          {isOpen && (
            <Section title="Give up on it" icon={XCircle}>
              <p className="mb-3 text-sm text-neutral/60">
                Cancelling closes the order without bringing anything in or owing anything.
              </p>
              <Button
                variant="ghost"
                className="text-error"
                onClick={act('cancel', 'Cancelled', `Cancel ${order.poNumber}?`)}
              >
                Cancel this order
              </Button>
            </Section>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(payForm)} onClose={() => setPayForm(null)} title="Settle this order">
        {payForm && (
          <form onSubmit={submitPayment} className="space-y-4">
            <p className="text-sm text-neutral/60">
              Receiving raised {naira(order.total)} as a payable to {order.vendor.name}. This clears
              it and takes the money out of the account it left.
            </p>

            <Select
              label="Paid from"
              value={payForm.paymentMethod}
              onChange={(event) => setPayForm({ ...payForm, paymentMethod: event.target.value })}
            >
              {METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>
            <Input
              label="Paid on"
              type="date"
              required
              value={payForm.paidOn}
              onChange={(event) => setPayForm({ ...payForm, paidOn: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setPayForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Record the payment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default PurchaseOrderDetail;
