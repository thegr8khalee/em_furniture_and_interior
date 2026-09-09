import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users } from 'lucide-react';
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
 * This is the list. One person is a page of its own at
 * `/admin/customers/:id` — a modal could not be linked to, opened twice, or
 * survive a refresh, which are the three things an operator on a call needs.
 *
 * Operators can add a record here. That was deliberately withheld at first — a
 * customer's details belong to the customer — but the shop takes most of its
 * orders in a showroom and over WhatsApp, and there was no way to write down who
 * bought the sofa. A record made here has no password and never can be signed in
 * to; if that person later signs up themselves, the email matches and they adopt
 * their own history.
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
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [buyersOnly, setBuyersOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [customerForm, setCustomerForm] = useState(null);
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

  const submitCustomer = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data: created } = await axiosInstance.post('/customers', {
        fullName: customerForm.fullName.trim(),
        email: customerForm.email.trim(),
        phoneNumber: customerForm.phoneNumber.trim() || null,
      });

      toast.success(created.message);
      setCustomerForm(null);
      // Straight to their page: somebody who has just been added is somebody
      // an operator is about to do something with.
      navigate(`/admin/customers/${created.customer._id}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save that customer');
    } finally {
      setIsSaving(false);
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
      actions={
        <Button
          leftIcon={UserPlus}
          onClick={() => setCustomerForm({ fullName: '', email: '', phoneNumber: '' })}
        >
          Add customer
        </Button>
      }
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

      <form
        onSubmit={runSearch}
        className="flex flex-wrap items-end gap-4 border border-base-300 bg-white p-5"
      >
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
                    onClick={() => navigate(`/admin/customers/${customer._id}`)}
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

      {/* No password field: a record made here can never be signed in to, which
          is why the shop is not choosing passwords for its customers. */}
      <Modal
        isOpen={Boolean(customerForm)}
        onClose={() => setCustomerForm(null)}
        title="Add a customer"
      >
        {customerForm && (
          <form onSubmit={submitCustomer} className="space-y-4">
            <Input
              label="Full name"
              value={customerForm.fullName}
              onChange={(event) =>
                setCustomerForm((form) => ({ ...form, fullName: event.target.value }))
              }
              required
            />
            <Input
              label="Email"
              type="email"
              value={customerForm.email}
              onChange={(event) =>
                setCustomerForm((form) => ({ ...form, email: event.target.value }))
              }
              hint="How their record is found again — and how they claim it if they sign up."
              required
            />
            <Input
              label="Phone"
              value={customerForm.phoneNumber}
              onChange={(event) =>
                setCustomerForm((form) => ({ ...form, phoneNumber: event.target.value }))
              }
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setCustomerForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Add customer
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Customers;
