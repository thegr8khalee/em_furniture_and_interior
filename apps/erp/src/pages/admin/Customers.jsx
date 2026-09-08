import { useCallback, useEffect, useState } from 'react';
import { MapPin, Search, Star, Users } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * The customer book.
 *
 * Everything here was already in the database and nothing put it together: the
 * console could not answer "who signed up this week", "has this person ordered
 * before", or "what did they buy last time" — the three questions somebody on
 * the phone is actually asking.
 *
 * Read-only, with one exception. A customer's own details belong to the
 * customer; an operator who could edit a name and an email could quietly become
 * somebody. Loyalty points are the exception, because a goodwill gesture is an
 * operator's decision — and it is recorded as a movement with a reason rather
 * than as a balance that changed for no stated cause.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : '—');

const SORTS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'spent', label: 'Highest spend' },
  { value: 'orders', label: 'Most orders' },
  { value: 'last_order', label: 'Bought most recently' },
  { value: 'name', label: 'Name' },
];

const Stat = ({ label, value, hint }) => (
  <div className="border border-base-300 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">{label}</p>
    <p className="mt-2 font-heading text-2xl font-bold text-neutral">{value}</p>
    {hint && <p className="mt-1 text-xs text-neutral/40">{hint}</p>}
  </div>
);

const Customers = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [buyersOnly, setBuyersOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loyaltyForm, setLoyaltyForm] = useState(null);
  // What one customer owes and what it is for. The ageing answers the
  // owner's question; this answers the customer's.
  const [statement, setStatement] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: '25', sort });
      if (query) params.set('search', query);
      if (buyersOnly) params.set('buyersOnly', 'true');

      const { data: list } = await axiosInstance.get(`/customers?${params}`);
      setData(list);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load customers');
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, query, buyersOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    axiosInstance
      .get('/customers/stats')
      .then(({ data: body }) => setStats(body.stats))
      .catch(() => {});
  }, []);

  const open = async (customer) => {
    setDetail({ loading: true, customer });
    setAddresses([]);

    try {
      const [{ data: body }, { data: places }] = await Promise.all([
        axiosInstance.get(`/customers/${customer._id}`),
        axiosInstance.get(`/customers/${customer._id}/addresses`),
      ]);
      setDetail(body);
      setAddresses(places.addresses);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that customer');
      setDetail(null);
    }
  };

  const submitLoyalty = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data: body } = await axiosInstance.post(
        `/customers/${loyaltyForm.customerId}/loyalty`,
        { points: Number(loyaltyForm.points), reason: loyaltyForm.reason }
      );
      toast.success(body.message);
      setLoyaltyForm(null);
      load();
      if (detail?.customer?._id === loyaltyForm.customerId) open(detail.customer);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not adjust that balance');
    } finally {
      setIsSaving(false);
    }
  };

  const openStatement = async (customer) => {
    setStatement({ loading: true, customer });

    try {
      const { data } = await axiosInstance.get(`/statements/customers/${customer._id}`);
      setStatement(data.statement);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not build that statement');
      setStatement(null);
    }
  };

  const downloadStatement = async (customerId, name) => {
    try {
      const { data } = await axiosInstance.get(`/statements/customers/${customerId}.csv`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${name.replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Could not export that statement');
    }
  };

  const runSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <AdminPageShell
      title="Customers"
      subtitle="Everyone with an account, what they have bought, and what they are worth"
    >
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Accounts" value={stats.total.toLocaleString()} />
          <Stat label="New this month" value={stats.newThisMonth.toLocaleString()} />
          <Stat
            label="Have bought"
            value={stats.buyers.toLocaleString()}
            hint={`${stats.total - stats.buyers} have not ordered yet`}
          />
          <Stat label="Revenue from accounts" value={naira(stats.revenue)} />
        </div>
      )}

      <form onSubmit={runSearch} className="flex flex-wrap items-end gap-4 border border-base-300 bg-white p-5">
        <Input
          label="Search"
          icon={Search}
          placeholder="Name, email or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          wrapperClassName="max-w-sm"
        />
        <Select
          label="Sort by"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          wrapperClassName="max-w-xs"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-3 pb-3">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={buyersOnly}
            onChange={(event) => {
              setBuyersOnly(event.target.checked);
              setPage(1);
            }}
          />
          <span className="text-sm text-neutral">Only people who have bought</span>
        </label>
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>

      {isLoading || !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : data.customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody here"
          description={query ? 'Nothing matched that search.' : 'No one has signed up yet.'}
        />
      ) : (
        <div className="border border-base-300 bg-white">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Spent</th>
                  <th>Last order</th>
                  <th className="text-right">Points</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((customer) => (
                  <tr
                    key={customer._id}
                    className="hover cursor-pointer"
                    onClick={() => open(customer)}
                  >
                    <td>
                      <span className="font-medium">{customer.username}</span>
                      {customer.signsInWith === 'supabase' && (
                        <Badge variant="info" className="ml-2">
                          social
                        </Badge>
                      )}
                    </td>
                    <td className="text-sm text-neutral/60">
                      {customer.email}
                      {customer.phoneNumber && (
                        <span className="block text-xs">{customer.phoneNumber}</span>
                      )}
                    </td>
                    <td className="text-right">{customer.orderCount}</td>
                    <td className="text-right font-mono tabular-nums">
                      {naira(customer.totalSpent)}
                    </td>
                    <td className="whitespace-nowrap text-sm text-neutral/60">
                      {day(customer.lastOrderAt)}
                    </td>
                    <td className="text-right">{customer.loyaltyPoints}</td>
                    <td className="whitespace-nowrap text-sm text-neutral/60">
                      {day(customer.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-base-300 px-5 py-3">
            <span className="text-sm text-neutral/50">
              {data.pagination.total} {data.pagination.total === 1 ? 'person' : 'people'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-neutral/50">
                {page} / {Math.max(data.pagination.pages, 1)}
              </span>
              <Button
                variant="ghost"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* One person, and everything the business knows about them — which is
          what an operator wants while they still have them on the phone. */}
      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.customer?.username || 'Loading…'}
        className="max-w-4xl"
      >
        {detail?.loading ? (
          <SkeletonBlock className="h-64 w-full" />
        ) : detail ? (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="text-sm text-neutral/60">
                <p>{detail.customer.email}</p>
                {detail.customer.phoneNumber && <p>{detail.customer.phoneNumber}</p>}
                <p className="mt-1 text-xs">
                  Joined {day(detail.customer.createdAt)} · signs in with{' '}
                  {detail.customer.signsInWith}
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral/40">Spent</p>
                  <p className="font-mono text-lg font-semibold">
                    {naira(detail.customer.totalSpent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral/40">Points</p>
                  <p className="font-mono text-lg font-semibold">
                    {detail.customer.loyaltyPoints}
                  </p>
                  <Button variant="ghost" onClick={() => openStatement(detail.customer)}>
                    Statement
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setLoyaltyForm({
                        customerId: detail.customer._id,
                        name: detail.customer.username,
                        points: '',
                        reason: '',
                      })
                    }
                  >
                    Adjust
                  </Button>
                </div>
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                Orders ({detail.orders.length})
              </h3>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-neutral/40">Nothing bought yet.</p>
              ) : (
                <table className="table table-sm w-full">
                  <tbody>
                    {detail.orders.map((order) => (
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
              )}
            </section>

            {addresses.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                  <MapPin size={14} /> Delivered to
                </h3>
                <ul className="space-y-1 text-sm text-neutral/70">
                  {addresses.map((address, index) => (
                    <li key={index}>
                      {address.address}, {address.city}, {address.state}
                      <span className="ml-2 text-xs text-neutral/40">
                        last used {day(address.lastUsed)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.loyalty.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                  Loyalty
                </h3>
                <table className="table table-sm w-full">
                  <tbody>
                    {detail.loyalty.map((movement) => (
                      <tr key={movement._id}>
                        <td className="whitespace-nowrap text-sm">{day(movement.createdAt)}</td>
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
              </section>
            )}

            {detail.reviews.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                  <Star size={14} /> Reviews
                </h3>
                <ul className="space-y-2 text-sm">
                  {detail.reviews.map((review) => (
                    <li key={review._id} className="border-l-2 border-base-300 pl-3">
                      <span className="font-medium">{review.item}</span> · {review.rating}/5
                      {!review.isApproved && (
                        <Badge variant="warning" className="ml-2">
                          awaiting approval
                        </Badge>
                      )}
                      {review.comment && (
                        <p className="text-neutral/60">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.consultations.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
                  Consultations
                </h3>
                <ul className="space-y-1 text-sm text-neutral/70">
                  {detail.consultations.map((consultation) => (
                    <li key={consultation._id}>
                      {day(consultation.createdAt)} · <Badge status={consultation.status} />
                      {consultation.budget.max > 0 && (
                        <span className="ml-2 text-xs text-neutral/40">
                          budget {naira(consultation.budget.min)}–{naira(consultation.budget.max)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(loyaltyForm)}
        onClose={() => setLoyaltyForm(null)}
        title={loyaltyForm ? `Adjust points: ${loyaltyForm.name}` : ''}
        className="max-w-lg"
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
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
      {/* What they owe, and what it is for. */}
      <Modal
        isOpen={Boolean(statement)}
        onClose={() => setStatement(null)}
        title={statement?.customer ? `Statement · ${statement.customer.name}` : 'Statement'}
        className="max-w-3xl"
      >
        {statement?.loading ? (
          <SkeletonBlock className="h-64 w-full" />
        ) : statement ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="text-sm text-neutral/60">
                {statement.from} to {statement.to}
              </p>
              <Button
                variant="ghost"
                onClick={() => downloadStatement(statement.customer._id, statement.customer.name)}
              >
                Export
              </Button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              <table className="table table-sm table-pin-rows w-full">
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
                      <td className="text-right font-mono tabular-nums">{naira(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The only number most people read. */}
            <div className="flex items-center justify-between border-t-2 border-neutral pt-3">
              <span className="font-heading text-lg font-bold text-neutral">Amount due</span>
              <span className="font-mono text-xl font-bold">{naira(statement.amountDue)}</span>
            </div>
          </div>
        ) : null}
      </Modal>

    </AdminPageShell>
  );
};

export default Customers;
