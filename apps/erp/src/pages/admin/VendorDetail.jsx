import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, Pencil, Receipt, Truck } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, SkeletonBlock, Textarea } from '@em/ui';

/**
 * One vendor, on a page of its own.
 *
 * The purchasing screen could list vendors and list orders, and answering "what
 * do we buy from these people, and what do we owe them" meant reading two tabs
 * and doing the arithmetic. The figures were all there; nothing gathered them
 * against the name they belong to.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');

const EXPENSE_STATUS = { draft: 'neutral', approved: 'warning', paid: 'success', void: 'error' };
const PO_STATUS = {
  draft: 'neutral',
  sent: 'info',
  received: 'warning',
  cancelled: 'error',
};

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

const Stat = ({ label, value, hint, tone = '' }) => (
  <div className="border border-base-300 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">{label}</p>
    <p className={`mt-2 font-heading text-2xl font-bold ${tone || 'text-neutral'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-neutral/40">{hint}</p>}
  </div>
);

const VendorDetail = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      // There is no single-vendor read; the list carries what a vendor is, and
      // both the orders and the expenses filter by vendor already, so the page
      // is composed rather than served.
      const [vendors, purchaseOrders, costs] = await Promise.all([
        axiosInstance.get('/purchasing/vendors'),
        axiosInstance.get(`/purchasing/purchase-orders?vendorId=${vendorId}&limit=100`),
        axiosInstance.get(`/purchasing/expenses?vendorId=${vendorId}&limit=100`),
      ]);

      const found = vendors.data.vendors.find((row) => row._id === vendorId) ?? null;
      setVendor(found);
      setOrders(purchaseOrders.data.purchaseOrders);
      setExpenses(costs.data.expenses);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that vendor');
      setVendor(null);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitEdit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.patch(`/purchasing/vendors/${vendorId}`, editForm);
      toast.success('Vendor updated.');
      setEditForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save that vendor');
    } finally {
      setIsSaving(false);
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
        <SkeletonBlock className="h-96 w-full" />
      </AdminPageShell>
    );
  }

  if (!vendor) {
    return (
      <AdminPageShell title="Vendor not found">
        <EmptyState
          icon={Building2}
          title="No vendor with that id"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to purchasing"
          actionTo="/admin/purchasing"
        />
      </AdminPageShell>
    );
  }

  const spent =
    orders.reduce((total, row) => total + Number(row.total ?? 0), 0) +
    expenses
      .filter((row) => row.status !== 'void')
      .reduce((total, row) => total + Number(row.totalAmount ?? 0), 0);

  const openOrders = orders.filter((row) => row.status === 'draft' || row.status === 'sent');

  return (
    <AdminPageShell
      title={vendor.name}
      subtitle={vendor.isActive ? 'Active supplier' : 'No longer used'}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/purchasing">
            All purchasing
          </Button>
          <Button
            variant="secondary"
            leftIcon={Pencil}
            onClick={() =>
              setEditForm({
                name: vendor.name,
                email: vendor.email || '',
                phone: vendor.phone || '',
                address: vendor.address || '',
                notes: vendor.notes || '',
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
          label="Owed to them"
          value={naira(vendor.outstanding)}
          tone={Number(vendor.outstanding) > 0 ? 'text-error' : ''}
          hint={Number(vendor.outstanding) > 0 ? 'Approved and unpaid' : 'Nothing outstanding'}
        />
        <Stat label="Bought from them" value={naira(spent)} hint="Orders and expenses together" />
        <Stat
          label="Purchase orders"
          value={orders.length}
          hint={openOrders.length ? `${openOrders.length} still open` : 'None open'}
        />
        <Stat label="Expenses" value={expenses.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title={`Purchase orders (${orders.length})`} icon={Truck}>
            {orders.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="Nothing ordered from them yet"
                description="A purchase order is what brings stock in and raises what is owed. None has been raised against this vendor."
                actionLabel="Go to purchasing"
                actionTo="/admin/purchasing"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>PO</th>
                      <th>Raised</th>
                      <th>Lines</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order._id}
                        className="hover cursor-pointer"
                        onClick={() => navigate(`/admin/purchasing/orders/${order._id}`)}
                      >
                        <td className="font-mono text-xs">{order.poNumber}</td>
                        <td className="whitespace-nowrap text-sm">{day(order.createdAt)}</td>
                        <td className="text-sm">{order.items.length}</td>
                        <td>
                          <Badge variant={PO_STATUS[order.status]}>{order.status}</Badge>
                        </td>
                        <td className="text-right font-mono tabular-nums">{naira(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={`Expenses (${expenses.length})`} icon={Receipt}>
            {expenses.length === 0 ? (
              <p className="text-sm text-neutral/40">
                No cost has been booked against this vendor.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Date</th>
                      <th>What for</th>
                      <th>Account</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense._id}>
                        <td className="font-mono text-xs">{expense.expenseNumber}</td>
                        <td className="whitespace-nowrap text-sm">{day(expense.date)}</td>
                        <td className="text-sm">{expense.description}</td>
                        <td className="text-xs text-neutral/50">
                          {expense.account.code} {expense.account.name}
                        </td>
                        <td>
                          <Badge variant={EXPENSE_STATUS[expense.status]}>{expense.status}</Badge>
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(expense.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Contact" icon={Building2}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Email</dt>
                <dd className="break-all">{vendor.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Phone</dt>
                <dd>{vendor.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Address</dt>
                <dd className="whitespace-pre-wrap">{vendor.address || '—'}</dd>
              </div>
            </dl>
          </Section>

          {vendor.notes && (
            <Section title="Notes" icon={FileText}>
              <p className="whitespace-pre-wrap text-sm text-neutral/70">{vendor.notes}</p>
            </Section>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(editForm)} onClose={() => setEditForm(null)} title="Edit vendor">
        {editForm && (
          <form onSubmit={submitEdit} className="space-y-4">
            <Input
              label="Name"
              required
              value={editForm.name}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              />
              <Input
                label="Phone"
                value={editForm.phone}
                onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
              />
            </div>
            <Textarea
              label="Address"
              rows={2}
              value={editForm.address}
              onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
            />
            <Textarea
              label="Notes"
              rows={2}
              value={editForm.notes}
              onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
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
    </AdminPageShell>
  );
};

export default VendorDetail;
