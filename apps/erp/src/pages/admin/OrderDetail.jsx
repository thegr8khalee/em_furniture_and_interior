import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Clock,
  Download,
  FileText,
  MapPin,
  Package,
  Undo2,
  User,
} from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock, Textarea } from '@em/ui';

/**
 * One order, on a page of its own.
 *
 * The list could show an order and change it, but never explain it: the money
 * broke down nowhere, the status history was not on screen at all, and the
 * payments behind an order marked paid were invisible. Those are the three
 * things somebody looks at when a customer rings up disputing something, and
 * all three were only in the database.
 *
 * The actions live here too, on the record they act on, rather than behind a
 * row of icon buttons in a table.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const moment = (value) =>
  value
    ? new Date(value).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');

// `refunded` is not on this list on purpose. Choosing it used to move a word and
// nothing else — the revenue stayed recognised, the cash stayed in the bank and
// the VAT stayed owed. The only way there is the refund action, which posts.
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash_on_delivery', label: 'Cash' },
  { value: 'paystack', label: 'Card / Paystack' },
];

const Section = ({ title, icon: Icon, action, children, className = '' }) => (
  <section className={`border border-base-300 bg-white p-6 ${className}`}>
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

const Row = ({ label, value, strong = false, tone = '' }) => (
  <div
    className={`flex items-baseline justify-between gap-4 py-1 ${
      strong ? 'border-t border-neutral pt-2 font-semibold' : ''
    }`}
  >
    <span className={strong ? 'text-neutral' : 'text-sm text-neutral/60'}>{label}</span>
    <span className={`font-mono tabular-nums ${tone} ${strong ? 'text-lg' : 'text-sm'}`}>
      {value}
    </span>
  </div>
);

const Address = ({ address }) => {
  if (!address) return <p className="text-sm text-neutral/40">Not given.</p>;

  return (
    <address className="space-y-0.5 text-sm not-italic text-neutral/70">
      <p className="font-medium text-neutral">{address.fullName}</p>
      {address.address && <p>{address.address}</p>}
      <p>{[address.city, address.state].filter(Boolean).join(', ')}</p>
      {address.phone && <p>{address.phone}</p>}
      {address.email && <p className="break-all">{address.email}</p>}
    </address>
  );
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [statusForm, setStatusForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);
  const [refundForm, setRefundForm] = useState(null);
  const [refunds, setRefunds] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data } = await axiosInstance.get(`/orders/admin/${orderId}`);
      setOrder(data.order);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that order');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  const loadRefunds = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/orders/admin/${orderId}/refunds`);
      setRefunds(data);
    } catch {
      // A refund history that will not load is not a reason to fail the page —
      // everything else on it is still worth reading.
      setRefunds(null);
    }
  }, [orderId]);

  useEffect(() => {
    load();
    loadRefunds();
  }, [load, loadRefunds]);

  const submitStatus = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.put(`/orders/admin/${orderId}/status`, statusForm);
      toast.success('Order updated.');
      setStatusForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not update that order');
    } finally {
      setIsSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.post(`/orders/admin/${orderId}/payments`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || null,
      });

      toast.success(data.message);
      setPaymentForm(null);
      load();
      loadRefunds();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not record that payment');
    } finally {
      setIsSaving(false);
    }
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.post(`/orders/admin/${orderId}/refunds`, {
        amount: Number(refundForm.amount),
        reason: refundForm.reason,
        restock: refundForm.restock,
      });

      toast.success(data.message);
      setRefundForm(null);
      load();
      loadRefunds();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not refund that order');
    } finally {
      setIsSaving(false);
    }
  };

  const download = async (kind) => {
    try {
      const { data } = await axiosInstance.get(`/orders/admin/${orderId}/${kind}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${kind}-${order.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(`Could not build that ${kind}`);
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
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonBlock className="h-96 w-full lg:col-span-2" />
          <SkeletonBlock className="h-96 w-full" />
        </div>
      </AdminPageShell>
    );
  }

  if (!order) {
    return (
      <AdminPageShell title="Order not found">
        <EmptyState
          icon={Package}
          title="No order with that reference"
          description="It may have been deleted, or the link may be wrong. The order list has everything that still exists."
          actionLabel="Back to orders"
          actionTo="/admin/orders"
        />
      </AdminPageShell>
    );
  }

  const canTakeMoney = order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded';

  return (
    <AdminPageShell
      title={order.orderNumber}
      subtitle={`Placed ${moment(order.createdAt)}${
        order.isGuestOrder ? ' · guest checkout' : ''
      }`}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/orders">
            All orders
          </Button>
          {canTakeMoney && (
            <Button
              variant="secondary"
              leftIcon={Banknote}
              onClick={() =>
                setPaymentForm({ amount: '', method: 'bank_transfer', reference: '' })
              }
            >
              Record a payment
            </Button>
          )}
          <Button
            onClick={() =>
              setStatusForm({
                status: order.status,
                note: '',
                trackingNumber: order.trackingNumber || '',
                trackingUrl: order.trackingUrl || '',
                carrier: order.carrier || '',
                estimatedDeliveryDate: order.estimatedDeliveryDate
                  ? String(order.estimatedDeliveryDate).slice(0, 10)
                  : '',
              })
            }
          >
            Update status
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Status
          </p>
          <div className="mt-2">
            <Badge status={order.status} />
          </div>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Payment
          </p>
          <div className="mt-2">
            <Badge status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-xs text-neutral/40">{order.paymentMethod}</p>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">Total</p>
          <p className="mt-2 font-heading text-2xl font-bold text-neutral">
            {naira(order.totalAmount)}
          </p>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Still refundable
          </p>
          <p className="mt-2 font-heading text-2xl font-bold text-neutral">
            {refunds ? naira(refunds.refundable) : '—'}
          </p>
          {refunds?.refunded > 0 && (
            <p className="mt-1 text-xs text-error">{naira(refunds.refunded)} given back</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title={`Items (${order.items.length})`} icon={Package}>
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>What</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item._id || item.name}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right font-mono tabular-nums">{naira(item.price)}</td>
                      <td className="text-right font-mono tabular-nums">
                        {naira(Number(item.price) * Number(item.quantity))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 ml-auto max-w-sm">
              <Row label="Subtotal" value={naira(order.subtotal)} />
              {Number(order.discount) > 0 && (
                <Row
                  label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`}
                  value={`−${naira(order.discount)}`}
                  tone="text-success"
                />
              )}
              {Number(order.shippingCost) > 0 && (
                <Row label="Delivery" value={naira(order.shippingCost)} />
              )}
              {Number(order.taxAmount) > 0 && <Row label="VAT" value={naira(order.taxAmount)} />}
              <Row label="Total" value={naira(order.totalAmount)} strong />
            </div>
          </Section>

          {/* Who changed what, when, and what note they left. Written by a
              database trigger, so a bulk update is in here too. */}
          <Section title="History" icon={Clock}>
            {!order.statusHistory || order.statusHistory.length === 0 ? (
              <p className="text-sm text-neutral/40">
                Nothing has happened to this order since it was placed.
              </p>
            ) : (
              <ol className="space-y-4">
                {order.statusHistory.map((event, index) => (
                  <li key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                      {index < order.statusHistory.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-base-300" />
                      )}
                    </div>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={event.status} />
                        <span className="text-xs text-neutral/50">{moment(event.timestamp)}</span>
                      </div>
                      {event.note && <p className="mt-1 text-sm text-neutral/70">{event.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section
            title="Refunds"
            icon={Undo2}
            action={
              refunds && Number(refunds.refundable) > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setRefundForm({
                      amount: String(refunds.refundable),
                      reason: '',
                      restock: false,
                    })
                  }
                >
                  Give money back
                </Button>
              ) : null
            }
          >
            {!refunds || refunds.refunds.length === 0 ? (
              <p className="text-sm text-neutral/40">
                Nothing has been given back on this order.
              </p>
            ) : (
              <table className="table table-sm w-full">
                <tbody>
                  {refunds.refunds.map((refund) => (
                    <tr key={refund._id}>
                      <td className="whitespace-nowrap text-sm">{day(refund.createdAt)}</td>
                      <td className="text-sm text-neutral/70">{refund.reason || '—'}</td>
                      <td className="text-right font-mono tabular-nums text-error">
                        −{naira(refund.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Buyer" icon={User}>
            <Address address={order.shippingAddress} />

            {order.user && (
              <Button
                variant="ghost"
                className="mt-4 px-0"
                onClick={() => navigate(`/admin/customers/${order.user}`)}
              >
                Open their record
              </Button>
            )}
            {order.isGuestOrder && (
              <p className="mt-4 text-xs text-neutral/40">
                Checked out as a guest, so there is no account to open.
              </p>
            )}
          </Section>

          {!order.useSameAddressForBilling && order.billingAddress && (
            <Section title="Billed to" icon={MapPin}>
              <Address address={order.billingAddress} />
            </Section>
          )}

          <Section title="Delivery" icon={MapPin}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Carrier</dt>
                <dd>{order.carrier || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Tracking</dt>
                <dd className="break-all">
                  {order.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-secondary hover:underline"
                    >
                      {order.trackingNumber || 'Track'}
                    </a>
                  ) : (
                    order.trackingNumber || '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Expected</dt>
                <dd>{day(order.estimatedDeliveryDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Delivered</dt>
                <dd>{moment(order.deliveredAt)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Documents" icon={FileText}>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" leftIcon={Download} onClick={() => download('invoice')}>
                Invoice
              </Button>
              <Button variant="ghost" leftIcon={Download} onClick={() => download('receipt')}>
                Receipt
              </Button>
              <Button variant="ghost" leftIcon={Download} onClick={() => download('quotation')}>
                Quotation
              </Button>
            </div>
          </Section>

          {order.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-sm text-neutral/70">{order.notes}</p>
            </Section>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(statusForm)} onClose={() => setStatusForm(null)} title="Update status">
        {statusForm && (
          <form onSubmit={submitStatus} className="space-y-4">
            <Select
              label="Status"
              value={statusForm.status}
              onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Carrier"
                value={statusForm.carrier}
                onChange={(event) => setStatusForm({ ...statusForm, carrier: event.target.value })}
              />
              <Input
                label="Tracking number"
                value={statusForm.trackingNumber}
                onChange={(event) =>
                  setStatusForm({ ...statusForm, trackingNumber: event.target.value })
                }
              />
              <Input
                label="Tracking link"
                value={statusForm.trackingUrl}
                onChange={(event) =>
                  setStatusForm({ ...statusForm, trackingUrl: event.target.value })
                }
              />
              <Input
                label="Expected delivery"
                type="date"
                value={statusForm.estimatedDeliveryDate}
                onChange={(event) =>
                  setStatusForm({ ...statusForm, estimatedDeliveryDate: event.target.value })
                }
              />
            </div>

            <Textarea
              label="Note"
              rows={2}
              placeholder="Why this changed — it goes into the history"
              value={statusForm.note}
              onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setStatusForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(paymentForm)}
        onClose={() => setPaymentForm(null)}
        title="Record a payment"
      >
        {paymentForm && (
          <form onSubmit={submitPayment} className="space-y-4">
            <p className="text-sm text-neutral/60">
              Money that has arrived. Whether it lands as a deposit or settles what is owed is the
              posting rule&apos;s decision, made from whether the sale has been recognised yet.
            </p>

            <Input
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
            />
            <Select
              label="How it arrived"
              value={paymentForm.method}
              onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}
            >
              {METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>
            <Input
              label="Reference"
              placeholder="Transfer reference, if there is one"
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, reference: event.target.value })
              }
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setPaymentForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Record it
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(refundForm)} onClose={() => setRefundForm(null)} title="Give money back">
        {refundForm && (
          <form onSubmit={submitRefund} className="space-y-4">
            <p className="text-sm text-neutral/60">
              This posts: the sale is unwound, the cash leaves, and the VAT on it comes back off
              what is owed. {naira(refunds?.refundable ?? 0)} is still refundable.
            </p>

            <Input
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={refundForm.amount}
              onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })}
            />
            <Input
              label="Reason"
              required
              placeholder="Damaged on delivery"
              value={refundForm.reason}
              onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })}
            />
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={refundForm.restock}
                onChange={(event) =>
                  setRefundForm({ ...refundForm, restock: event.target.checked })
                }
              />
              <span className="text-sm text-neutral">The goods came back — put them in stock</span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setRefundForm(null)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" isLoading={isSaving}>
                Refund
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default OrderDetail;
