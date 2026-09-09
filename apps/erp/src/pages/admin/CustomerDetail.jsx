import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  MapPin,
  Package,
  Pencil,
  Receipt,
  Star,
  Trash2,
} from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, SkeletonBlock } from '@em/ui';

/**
 * One customer, on a page of their own.
 *
 * All of this used to be a modal over the list. That was fine for a glance and
 * wrong for everything else: an operator on the phone could not send anybody the
 * link, could not open two people side by side, and lost the lot on a refresh —
 * and the modal had to stay small, so the statement and the order history were
 * fighting for the same scroll box.
 *
 * A page has an address. That is most of the point.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');

const Stat = ({ label, value, hint, tone = '' }) => (
  <div className="border border-base-300 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">{label}</p>
    <p className={`mt-2 font-heading text-2xl font-bold ${tone || 'text-neutral'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-neutral/40">{hint}</p>}
  </div>
);

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

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [statement, setStatement] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState(null);
  const [loyaltyForm, setLoyaltyForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const [{ data: body }, { data: places }] = await Promise.all([
        axiosInstance.get(`/customers/${customerId}`),
        axiosInstance.get(`/customers/${customerId}/addresses`),
      ]);

      setDetail(body);
      setAddresses(places.addresses);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that customer');
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  // The statement is a second query and most visits do not need it, so it is
  // fetched when somebody asks rather than on the way in.
  const loadStatement = async () => {
    setStatement({ loading: true });

    try {
      const { data } = await axiosInstance.get(`/statements/customers/${customerId}`);
      setStatement(data.statement);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not build that statement');
      setStatement(null);
    }
  };

  const downloadStatement = async () => {
    try {
      const { data } = await axiosInstance.get(`/statements/customers/${customerId}.csv`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${(detail?.customer?.username || 'customer').replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export that statement');
    }
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.patch(`/customers/${customerId}`, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phoneNumber: editForm.phoneNumber.trim() || null,
      });

      toast.success('Details updated.');
      setEditForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save those details');
    } finally {
      setIsSaving(false);
    }
  };

  const submitLoyalty = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.post(`/customers/${customerId}/loyalty`, {
        points: Number(loyaltyForm.points),
        reason: loyaltyForm.reason,
      });

      toast.success(data.message);
      setLoyaltyForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not adjust that balance');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.delete(`/customers/${customerId}`);
      toast.success(data.message);
      navigate('/admin/customers');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not remove that customer');
      setConfirmDelete(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Loading…">
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </AdminPageShell>
    );
  }

  if (!detail) {
    return (
      <AdminPageShell title="Not found" subtitle="Nobody here by that id">
        <Button leftIcon={ArrowLeft} to="/admin/customers">
          Back to customers
        </Button>
      </AdminPageShell>
    );
  }

  const { customer, orders, loyalty, reviews, consultations } = detail;

  return (
    <AdminPageShell
      title={customer.username}
      subtitle={`Customer since ${day(customer.createdAt)} · signs in with ${customer.signsInWith}`}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/customers">
            All customers
          </Button>
          <Button
            variant="ghost"
            leftIcon={Receipt}
            to={`/admin/sales/new?customer=${customer._id}`}
          >
            Record a sale
          </Button>
          <Button
            variant="secondary"
            leftIcon={Pencil}
            onClick={() =>
              setEditForm({
                fullName: customer.username,
                email: customer.email,
                phoneNumber: customer.phoneNumber || '',
              })
            }
          >
            Edit
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Spent"
          value={naira(customer.totalSpent)}
          hint={`${orders.length} order${orders.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Loyalty points"
          value={customer.loyaltyPoints}
          hint={loyalty.length ? `${loyalty.length} movements` : 'No movements yet'}
        />
        <Stat
          label="Last order"
          value={day(customer.lastOrderAt)}
          hint={customer.lastOrderAt ? '' : 'Has not bought yet'}
        />
        <Stat
          label="Owing"
          value={statement && !statement.loading ? naira(statement.amountDue) : '—'}
          hint={statement && !statement.loading ? '' : 'Open the statement to work it out'}
          tone={
            statement && !statement.loading && Number(statement.amountDue) > 0 ? 'text-error' : ''
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title={`Orders (${orders.length})`}>
            {orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nothing bought yet"
                description="They have an account but no orders against it. A sale made in the showroom counts — it just has to be written down."
                actionLabel="Record a sale"
                actionTo={`/admin/sales/new?customer=${customer._id}`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>What</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id}>
                        <td className="font-mono text-xs">{order.orderNumber}</td>
                        <td className="whitespace-nowrap text-sm">{day(order.createdAt)}</td>
                        <td className="text-sm">
                          {order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}
                        </td>
                        <td>
                          <Badge status={order.status} />
                        </td>
                        <td>
                          <Badge status={order.paymentStatus} />
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(order.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* What they owe and what it is for. The ageing answers the owner's
              question; this answers the customer's. */}
          <Section
            title="Statement"
            action={
              statement && !statement.loading ? (
                <Button variant="ghost" leftIcon={Download} onClick={downloadStatement}>
                  Export
                </Button>
              ) : (
                <Button variant="ghost" onClick={loadStatement}>
                  Build it
                </Button>
              )
            }
          >
            {!statement ? (
              <p className="text-sm text-neutral/40">
                Every charge and every payment over the last year, with a running balance.
              </p>
            ) : statement.loading ? (
              <SkeletonBlock className="h-40 w-full" />
            ) : (
              <>
                <p className="mb-3 text-sm text-neutral/50">
                  {statement.from} to {statement.to}
                </p>

                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th className="text-right">Charged</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-neutral/60">
                        <td colSpan={5}>Balance brought forward</td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(statement.openingBalance)}
                        </td>
                      </tr>
                      {statement.lines.map((line, index) => (
                        <tr key={index}>
                          <td className="whitespace-nowrap">{line.date}</td>
                          <td className="font-mono text-xs">{line.reference}</td>
                          <td className="text-sm text-neutral/60">{line.kind}</td>
                          <td className="text-right font-mono tabular-nums">
                            {Number(line.charged) ? naira(line.charged) : ''}
                          </td>
                          <td className="text-right font-mono tabular-nums">
                            {Number(line.paid) ? naira(line.paid) : ''}
                          </td>
                          <td className="text-right font-mono tabular-nums">
                            {naira(line.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* The only number most people read. */}
                <div className="mt-4 flex items-center justify-between border-t-2 border-neutral pt-3">
                  <span className="font-heading text-lg font-bold text-neutral">Amount due</span>
                  <span className="font-mono text-xl font-bold">{naira(statement.amountDue)}</span>
                </div>
              </>
            )}
          </Section>

          {reviews.length > 0 && (
            <Section title={`Reviews (${reviews.length})`} icon={Star}>
              <ul className="space-y-3 text-sm">
                {reviews.map((review) => (
                  <li key={review._id} className="border-l-2 border-base-300 pl-3">
                    <span className="font-medium">{review.item}</span> · {review.rating}/5
                    {!review.isApproved && (
                      <Badge variant="warning" className="ml-2">
                        awaiting approval
                      </Badge>
                    )}
                    {review.comment && <p className="text-neutral/60">{review.comment}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Contact">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Email</dt>
                <dd className="break-all">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Phone</dt>
                <dd>{customer.phoneNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Signs in with</dt>
                <dd>{customer.signsInWith}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-base-300 pt-4">
              <Button
                variant="ghost"
                onClick={() =>
                  setLoyaltyForm({ points: '', reason: '', name: customer.username })
                }
              >
                Adjust points
              </Button>
              <Button
                variant="ghost"
                leftIcon={Trash2}
                className="text-error"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>
          </Section>

          {addresses.length > 0 && (
            <Section title="Delivered to" icon={MapPin}>
              <ul className="space-y-3 text-sm text-neutral/70">
                {addresses.map((address, index) => (
                  <li key={index}>
                    {address.address}, {address.city}, {address.state}
                    <span className="block text-xs text-neutral/40">
                      last used {day(address.lastUsed)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {loyalty.length > 0 && (
            <Section title="Loyalty">
              <table className="table table-sm w-full">
                <tbody>
                  {loyalty.map((movement) => (
                    <tr key={movement._id}>
                      <td className="whitespace-nowrap text-xs">{day(movement.createdAt)}</td>
                      <td className="text-sm">
                        {movement.description || movement.type}
                        {/* The description usually names the order already —
                            printing it again read "ORD-2026-00006ORD-2026-00006". */}
                        {movement.orderNumber &&
                          !String(movement.description).includes(movement.orderNumber) && (
                            <span className="ml-2 font-mono text-xs text-neutral/40">
                              {movement.orderNumber}
                            </span>
                          )}
                      </td>
                      <td
                        className={`text-right font-mono ${
                          movement.points < 0 ? 'text-error' : 'text-success'
                        }`}
                      >
                        {movement.points > 0 ? '+' : ''}
                        {movement.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {consultations.length > 0 && (
            <Section title="Consultations">
              <ul className="space-y-2 text-sm text-neutral/70">
                {consultations.map((consultation) => (
                  <li key={consultation._id}>
                    {day(consultation.createdAt)} · <Badge status={consultation.status} />
                    {consultation.budget.max > 0 && (
                      <span className="block text-xs text-neutral/40">
                        budget {naira(consultation.budget.min)}–{naira(consultation.budget.max)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(editForm)} onClose={() => setEditForm(null)} title="Edit customer">
        {editForm && (
          <form onSubmit={submitEdit} className="space-y-4">
            <Input
              label="Full name"
              value={editForm.fullName}
              onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              required
            />
            <Input
              label="Phone"
              value={editForm.phoneNumber}
              onChange={(event) => setEditForm({ ...editForm, phoneNumber: event.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditForm(null)}>
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
        isOpen={Boolean(loyaltyForm)}
        onClose={() => setLoyaltyForm(null)}
        title={loyaltyForm ? `Adjust points: ${loyaltyForm.name}` : ''}
      >
        {loyaltyForm && (
          <form onSubmit={submitLoyalty} className="space-y-4">
            <p className="text-sm text-neutral/60">
              Positive adds, negative takes away. This is recorded as a movement with the reason
              you give — a balance nobody can explain is worse than a wrong one.
            </p>

            <Input
              label="Points"
              type="number"
              step="1"
              required
              value={loyaltyForm.points}
              onChange={(event) => setLoyaltyForm({ ...loyaltyForm, points: event.target.value })}
            />
            <Input
              label="Reason"
              required
              placeholder="Goodwill after a late delivery"
              value={loyaltyForm.reason}
              onChange={(event) => setLoyaltyForm({ ...loyaltyForm, reason: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setLoyaltyForm(null)}>
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
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this customer?"
      >
        <p className="text-sm text-neutral/70">
          {customer.username} will be removed for good. Anyone who has ordered cannot be deleted —
          their name is on those orders.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep them
          </Button>
          <Button variant="danger" isLoading={isSaving} onClick={remove}>
            Delete
          </Button>
        </div>
      </Modal>
    </AdminPageShell>
  );
};

export default CustomerDetail;
