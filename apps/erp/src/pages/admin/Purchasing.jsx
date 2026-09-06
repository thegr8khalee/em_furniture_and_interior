import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Receipt, Truck } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock, Textarea } from '@em/ui';

/**
 * What the business buys.
 *
 * Two documents, and the difference between them is when they hit the books. An
 * **expense** is money spent: approving it makes it a cost and a debt, paying it
 * settles the debt. A **purchase order** is an intention, and it becomes stock
 * and a liability only when the goods arrive.
 *
 * Every button here that changes a status also posts, in the same transaction,
 * so nothing on this screen can leave a document saying one thing and the ledger
 * saying another. The refusals matter as much as the actions: only an approved
 * expense can be paid, only a draft can be voided, and a received order cannot
 * be cancelled.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);

const TABS = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'orders', label: 'Purchase orders' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'payables', label: 'Payables' },
];

const EXPENSE_STATUS = {
  draft: 'neutral',
  approved: 'warning',
  paid: 'success',
  void: 'error',
};

const ORDER_STATUS = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'error',
};

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash_on_delivery', label: 'Cash' },
  { value: 'paystack', label: 'Paystack' },
];

const Panel = ({ title, description, actions, children }) => (
  <div className="border border-base-300 bg-white">
    {(title || actions) && (
      <div className="flex flex-col gap-2 border-b border-base-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral">{title}</h2>
          {description && <p className="mt-1 text-sm text-neutral/50">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

const Purchasing = () => {
  const [tab, setTab] = useState('expenses');
  const [isLoading, setIsLoading] = useState(false);

  const [expenses, setExpenses] = useState(null);
  const [orders, setOrders] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [payables, setPayables] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);

  const [statusFilter, setStatusFilter] = useState('');

  const [expenseForm, setExpenseForm] = useState(null);
  const [vendorForm, setVendorForm] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  // One modal for both kinds of payable: an approved expense and a received
  // purchase order are the same question — paid by what, and when?
  const [paying, setPaying] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vendors are needed on nearly every form, so they are loaded once rather
  // than per tab.
  const loadVendors = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/purchasing/vendors');
      setVendors(data.vendors);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load vendors');
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'expenses') {
        const query = statusFilter ? `?status=${statusFilter}` : '';
        const { data } = await axiosInstance.get(`/purchasing/expenses${query}`);
        setExpenses(data);
      } else if (tab === 'orders') {
        const query = statusFilter ? `?status=${statusFilter}` : '';
        const { data } = await axiosInstance.get(`/purchasing/purchase-orders${query}`);
        setOrders(data);
      } else if (tab === 'vendors') {
        await loadVendors();
      } else if (tab === 'payables') {
        const { data } = await axiosInstance.get('/purchasing/payables');
        setPayables(data.payables);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that');
    } finally {
      setIsLoading(false);
    }
  }, [tab, statusFilter, loadVendors]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  /**
   * The chart of accounts, filtered to the postable expense ones.
   *
   * A cost booked to a summary account would never appear beneath it in any
   * report, and the API refuses one — so the form should not offer it.
   */
  const openExpenseForm = async () => {
    if (accounts.length === 0) {
      try {
        const { data } = await axiosInstance.get('/books/accounts');
        setAccounts(data.accounts.filter((a) => a.type === 'expense' && a.isPostable));
      } catch (error) {
        toast.error('Could not load the chart of accounts');
        return;
      }
    }

    setExpenseForm({
      vendorId: '',
      accountCode: '',
      description: '',
      date: today(),
      netAmount: '',
      taxAmount: '',
      notes: '',
    });
  };

  const openOrderForm = async () => {
    if (products.length === 0) {
      try {
        const { data } = await axiosInstance.get('/products?limit=200');
        setProducts(data.products || data.data || []);
      } catch (error) {
        toast.error('Could not load products');
        return;
      }
    }

    setOrderForm({
      vendorId: '',
      expectedOn: '',
      notes: '',
      items: [{ product: '', quantity: 1, unitCost: '' }],
    });
  };

  const submit = async (request, message) => {
    setIsSaving(true);
    try {
      await request();
      toast.success(message);
      load();
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || 'That did not work');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveExpense = async () => {
    const done = await submit(
      () => axiosInstance.post('/purchasing/expenses', expenseForm),
      'Expense recorded as a draft'
    );
    if (done) setExpenseForm(null);
  };

  const saveVendor = async () => {
    const done = await submit(
      () =>
        vendorForm._id
          ? axiosInstance.patch(`/purchasing/vendors/${vendorForm._id}`, vendorForm)
          : axiosInstance.post('/purchasing/vendors', vendorForm),
      vendorForm._id ? 'Vendor updated' : 'Vendor added'
    );
    if (done) {
      setVendorForm(null);
      loadVendors();
    }
  };

  const saveOrder = async () => {
    const done = await submit(
      () => axiosInstance.post('/purchasing/purchase-orders', orderForm),
      'Purchase order created'
    );
    if (done) setOrderForm(null);
  };

  const act = (path, message, confirmation) => async () => {
    if (confirmation && !window.confirm(confirmation)) return;
    await submit(() => axiosInstance.post(path), message);
  };

  const pay = async () => {
    const done = await submit(
      () =>
        axiosInstance.post(`/purchasing/${paying.path}/${paying._id}/pay`, {
          paymentMethod: paying.paymentMethod,
          paidOn: paying.paidOn,
        }),
      'Paid, and the payable is cleared'
    );
    if (done) setPaying(null);
  };

  const setLine = (index, field, value) =>
    setOrderForm((form) => ({
      ...form,
      items: form.items.map((line, position) =>
        position === index ? { ...line, [field]: value } : line
      ),
    }));

  const orderTotal = (orderForm?.items ?? []).reduce(
    (total, line) => total + Number(line.quantity || 0) * Number(line.unitCost || 0),
    0
  );

  return (
    <AdminPageShell
      title="Purchasing"
      subtitle="Vendors, expenses and purchase orders — each one posts to the books as it changes"
      actions={
        tab === 'expenses' ? (
          <Button variant="primary" leftIcon={Plus} onClick={openExpenseForm}>
            Record an expense
          </Button>
        ) : tab === 'orders' ? (
          <Button variant="primary" leftIcon={Plus} onClick={openOrderForm}>
            New purchase order
          </Button>
        ) : tab === 'vendors' ? (
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => setVendorForm({ name: '', email: '', phone: '', address: '' })}
          >
            Add a vendor
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-1 border-b border-base-300">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setStatusFilter('');
            }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'border-b-2 border-secondary text-neutral'
                : 'border-b-2 border-transparent text-neutral/50 hover:text-neutral'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(tab === 'expenses' || tab === 'orders') && (
        <div className="flex flex-wrap items-end gap-4 border border-base-300 bg-white p-5">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            wrapperClassName="max-w-xs"
          >
            <option value="">Everything</option>
            {tab === 'expenses'
              ? ['draft', 'approved', 'paid', 'void'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))
              : ['draft', 'sent', 'received', 'cancelled'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'expenses' && expenses && (
            <Panel
              title="Expenses"
              description={`${expenses.pagination.total} recorded · ${naira(
                expenses.totalValue
              )} in this view`}
            >
              {expenses.expenses.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No expenses yet"
                  description="Rent, salaries, marketing, a delivery van's fuel — anything the business pays for."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Account</th>
                        <th>Vendor</th>
                        <th className="text-right">Total</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.expenses.map((expense) => (
                        <tr key={expense._id} className="hover">
                          <td className="font-mono text-xs">{expense.expenseNumber}</td>
                          <td className="whitespace-nowrap">{expense.date}</td>
                          <td>{expense.description}</td>
                          <td className="text-sm text-neutral/60">
                            <span className="font-mono text-xs">{expense.account.code}</span>{' '}
                            {expense.account.name}
                          </td>
                          <td className="text-sm">{expense.vendor?.name ?? '—'}</td>
                          <td className="text-right font-mono tabular-nums">
                            {naira(expense.totalAmount)}
                            {Number(expense.taxAmount) > 0 && (
                              <span className="block text-xs text-neutral/40">
                                incl. {naira(expense.taxAmount)} VAT
                              </span>
                            )}
                          </td>
                          <td>
                            <Badge variant={EXPENSE_STATUS[expense.status]}>{expense.status}</Badge>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              {expense.status === 'draft' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    onClick={act(
                                      `/purchasing/expenses/${expense._id}/approve`,
                                      'Approved — the cost and the debt are in the books',
                                      `Approve ${expense.expenseNumber}? This books the cost and creates a payable.`
                                    )}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={act(
                                      `/purchasing/expenses/${expense._id}/void`,
                                      'Voided'
                                    )}
                                  >
                                    Void
                                  </Button>
                                </>
                              )}
                              {expense.status === 'approved' && (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setPaying({
                                      _id: expense._id,
                                      path: 'expenses',
                                      reference: expense.expenseNumber,
                                      description: expense.description,
                                      total: expense.totalAmount,
                                      vendor: expense.vendor,
                                      paymentMethod: 'bank_transfer',
                                      paidOn: today(),
                                    })
                                  }
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'orders' && orders && (
            <Panel title="Purchase orders" description={`${orders.pagination.total} in total`}>
              {orders.purchaseOrders.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No purchase orders"
                  description="Order stock from a supplier here; receiving it brings the stock in and raises the payable."
                />
              ) : (
                <div className="space-y-4">
                  {orders.purchaseOrders.map((order) => (
                    <div key={order._id} className="border border-base-300 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-semibold">
                              {order.poNumber}
                            </span>
                            <Badge variant={ORDER_STATUS[order.status]}>{order.status}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-neutral/60">
                            {order.vendor.name}
                            {order.expectedOn ? ` · expected ${order.expectedOn}` : ''}
                            {order.receivedOn ? ` · received ${order.receivedOn}` : ''}
                            {order.paidOn ? ` · paid ${order.paidOn}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold tabular-nums">
                            {naira(order.total)}
                          </span>
                          {order.status === 'draft' && (
                            <Button
                              variant="ghost"
                              onClick={act(
                                `/purchasing/purchase-orders/${order._id}/send`,
                                'Marked as sent'
                              )}
                            >
                              Mark sent
                            </Button>
                          )}
                          {/* Receiving the goods is what makes the money owed, so
                              this is where that debt gets settled. */}
                          {order.status === 'received' && !order.paidOn && (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setPaying({
                                  _id: order._id,
                                  path: 'purchase-orders',
                                  reference: order.poNumber,
                                  description: `${order.items.length} line${
                                    order.items.length === 1 ? '' : 's'
                                  }`,
                                  total: order.total,
                                  vendor: order.vendor,
                                  paymentMethod: 'bank_transfer',
                                  paidOn: today(),
                                })
                              }
                            >
                              Pay
                            </Button>
                          )}
                          {order.status === 'received' && order.paidOn && (
                            <Badge variant="success">paid</Badge>
                          )}
                          {(order.status === 'draft' || order.status === 'sent') && (
                            <>
                              <Button
                                variant="secondary"
                                onClick={act(
                                  `/purchasing/purchase-orders/${order._id}/receive`,
                                  'Received — stock is in and the payable is raised',
                                  `Receive ${order.poNumber}? This brings the stock in and raises what is owed.`
                                )}
                              >
                                Receive
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={act(
                                  `/purchasing/purchase-orders/${order._id}/cancel`,
                                  'Cancelled',
                                  `Cancel ${order.poNumber}?`
                                )}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <table className="table table-sm mt-3 w-full">
                        <tbody>
                          {order.items.map((line) => (
                            <tr key={line._id}>
                              <td>{line.name}</td>
                              <td className="w-24 text-right text-neutral/60">
                                {line.quantity} ×
                              </td>
                              <td className="w-32 text-right font-mono tabular-nums">
                                {naira(line.unitCost)}
                              </td>
                              <td className="w-32 text-right font-mono tabular-nums font-medium">
                                {naira(line.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === 'vendors' && (
            <Panel
              title="Vendors"
              description={`${vendors.length} ${
                vendors.length === 1 ? 'supplier' : 'suppliers'
              }`}
            >
              {vendors.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No vendors yet"
                  description="Add the suppliers you buy from; what you owe each of them shows up here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th className="text-right">Outstanding</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((vendor) => (
                        <tr key={vendor._id} className="hover">
                          <td className="font-medium">{vendor.name}</td>
                          <td className="text-sm text-neutral/60">{vendor.email ?? '—'}</td>
                          <td className="text-sm text-neutral/60">{vendor.phone ?? '—'}</td>
                          <td className="text-right font-mono tabular-nums">
                            {naira(vendor.outstanding)}
                          </td>
                          <td>
                            <Badge variant={vendor.isActive ? 'success' : 'neutral'}>
                              {vendor.isActive ? 'active' : 'retired'}
                            </Badge>
                          </td>
                          <td className="text-right">
                            <Button variant="ghost" onClick={() => setVendorForm({ ...vendor })}>
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'payables' && payables && (
            <Panel
              title="What is owed"
              description="Approved expenses and received orders not yet paid, oldest first"
            >
              {payables.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Nothing outstanding"
                  description="Every approved expense and received order has been paid."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th className="text-right">Current</th>
                        <th className="text-right">30 days</th>
                        <th className="text-right">60 days +</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payables.map((row, index) => (
                        <tr key={row.vendor?._id ?? `none-${index}`} className="hover">
                          <td className="font-medium">{row.vendor?.name ?? 'No vendor'}</td>
                          <td className="text-right font-mono tabular-nums">
                            {naira(row.current)}
                          </td>
                          <td className="text-right font-mono tabular-nums">
                            {naira(row.thirtyDays)}
                          </td>
                          <td className="text-right font-mono tabular-nums text-error">
                            {naira(row.sixtyDaysPlus)}
                          </td>
                          <td className="text-right font-mono tabular-nums font-semibold">
                            {naira(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral font-semibold text-neutral">
                        <td>Total owed</td>
                        <td colSpan={3} />
                        <td className="text-right font-mono tabular-nums">
                          {naira(payables.reduce((sum, row) => sum + Number(row.total), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </>
      )}

      {/* --- record an expense ------------------------------------------- */}
      <Modal
        isOpen={Boolean(expenseForm)}
        onClose={() => setExpenseForm(null)}
        title="Record an expense"
      >
        {expenseForm && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveExpense();
            }}
          >
            <p className="text-sm text-neutral/50">
              This is saved as a draft. Approving it is what books the cost and creates the debt.
            </p>

            <Input
              label="Description"
              required
              value={expenseForm.description}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, description: event.target.value })
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Book it to"
                required
                value={expenseForm.accountCode}
                onChange={(event) =>
                  setExpenseForm({ ...expenseForm, accountCode: event.target.value })
                }
              >
                <option value="">Choose an account</option>
                {accounts.map((account) => (
                  <option key={account.code} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Vendor"
                value={expenseForm.vendorId}
                onChange={(event) =>
                  setExpenseForm({ ...expenseForm, vendorId: event.target.value })
                }
              >
                <option value="">No vendor</option>
                {vendors
                  .filter((vendor) => vendor.isActive)
                  .map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Date"
                type="date"
                required
                value={expenseForm.date}
                onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })}
              />
              <Input
                label="Amount (₦)"
                type="number"
                min="0"
                step="0.01"
                required
                value={expenseForm.netAmount}
                onChange={(event) =>
                  setExpenseForm({ ...expenseForm, netAmount: event.target.value })
                }
              />
              <Input
                label="VAT (₦)"
                type="number"
                min="0"
                step="0.01"
                hint="Recoverable input VAT"
                value={expenseForm.taxAmount}
                onChange={(event) =>
                  setExpenseForm({ ...expenseForm, taxAmount: event.target.value })
                }
              />
            </div>

            <Textarea
              label="Notes"
              rows={2}
              value={expenseForm.notes}
              onChange={(event) => setExpenseForm({ ...expenseForm, notes: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setExpenseForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save as draft
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- pay one ------------------------------------------------------ */}
      <Modal
        isOpen={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={paying ? `Pay ${paying.reference}` : ''}
        className="max-w-lg"
      >
        {paying && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              pay();
            }}
          >
            <p className="text-sm text-neutral/60">
              {paying.description} · {naira(paying.total)} to{' '}
              {paying.vendor?.name ?? 'the supplier'}. This clears the payable and takes the money
              out of the account you choose.
            </p>

            <Select
              label="Paid by"
              required
              value={paying.paymentMethod}
              onChange={(event) => setPaying({ ...paying, paymentMethod: event.target.value })}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>

            <Input
              label="Paid on"
              type="date"
              value={paying.paidOn}
              onChange={(event) => setPaying({ ...paying, paidOn: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Mark paid
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- a vendor ----------------------------------------------------- */}
      <Modal
        isOpen={Boolean(vendorForm)}
        onClose={() => setVendorForm(null)}
        title={vendorForm?._id ? 'Edit vendor' : 'Add a vendor'}
        className="max-w-lg"
      >
        {vendorForm && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveVendor();
            }}
          >
            <Input
              label="Name"
              required
              value={vendorForm.name ?? ''}
              onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                value={vendorForm.email ?? ''}
                onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })}
              />
              <Input
                label="Phone"
                value={vendorForm.phone ?? ''}
                onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value })}
              />
            </div>
            <Textarea
              label="Address"
              rows={2}
              value={vendorForm.address ?? ''}
              onChange={(event) => setVendorForm({ ...vendorForm, address: event.target.value })}
            />

            {vendorForm._id && (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={vendorForm.isActive ?? true}
                  onChange={(event) =>
                    setVendorForm({ ...vendorForm, isActive: event.target.checked })
                  }
                />
                <span className="text-sm text-neutral">Still buying from them</span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setVendorForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- a purchase order --------------------------------------------- */}
      <Modal
        isOpen={Boolean(orderForm)}
        onClose={() => setOrderForm(null)}
        title="New purchase order"
        className="max-w-3xl"
      >
        {orderForm && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveOrder();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Vendor"
                required
                value={orderForm.vendorId}
                onChange={(event) => setOrderForm({ ...orderForm, vendorId: event.target.value })}
              >
                <option value="">Choose a vendor</option>
                {vendors
                  .filter((vendor) => vendor.isActive)
                  .map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
              </Select>
              <Input
                label="Expected on"
                type="date"
                value={orderForm.expectedOn}
                onChange={(event) =>
                  setOrderForm({ ...orderForm, expectedOn: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                Lines
              </span>
              {orderForm.items.map((line, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <Select
                    value={line.product}
                    onChange={(event) => setLine(index, 'product', event.target.value)}
                    wrapperClassName="flex-1 min-w-[12rem]"
                    required
                  >
                    <option value="">Choose a product</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) => setLine(index, 'quantity', event.target.value)}
                    wrapperClassName="w-24"
                    required
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(event) => setLine(index, 'unitCost', event.target.value)}
                    wrapperClassName="w-36"
                    required
                  />
                  {orderForm.items.length > 1 && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        setOrderForm({
                          ...orderForm,
                          items: orderForm.items.filter((_, position) => position !== index),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                type="button"
                leftIcon={Plus}
                onClick={() =>
                  setOrderForm({
                    ...orderForm,
                    items: [...orderForm.items, { product: '', quantity: 1, unitCost: '' }],
                  })
                }
              >
                Add a line
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-base-300 pt-3">
              <span className="text-sm text-neutral/50">
                Receiving this order books {naira(orderTotal)} of stock and the same again as a
                payable.
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {naira(orderTotal)}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setOrderForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Create
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Purchasing;
