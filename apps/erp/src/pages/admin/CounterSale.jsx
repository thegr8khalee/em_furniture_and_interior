import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock, Textarea } from '@em/ui';

/**
 * The counter.
 *
 * Until now the only thing that could create an order was the storefront
 * checkout: it needs a cart, a guest cookie and prices straight out of the
 * catalog. That is not how this shop sells. Most of it happens in a showroom or
 * on WhatsApp, at a price that was argued over — and none of it had anywhere to
 * go, so the books only ever saw the fraction that came through the website.
 *
 * This posts to the same service the checkout does. The order is numbered,
 * booked and stocked identically; the only difference is that the price the
 * operator typed wins, because the figure they agreed is the one that has to
 * reach the books, not the list price nobody paid.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const METHODS = [
  { value: 'cash_on_delivery', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'paystack', label: 'Card / Paystack' },
  { value: 'whatsapp', label: 'On account (unpaid)' },
];

const emptyLine = () => ({ product: '', quantity: 1, unitPrice: '' });

const CounterSale = () => {
  // A sale started from somebody's own page arrives with them named, so the
  // operator does not have to search for the person they were just looking at.
  const [params] = useSearchParams();
  const preselected = params.get('customer');
  const preselectedProduct = params.get('product');

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(null);

  // Who is buying. Three cases, because all three happen at a counter: somebody
  // already on the books, somebody new worth recording, and a walk-in who wants
  // a receipt and nothing else.
  const [buyer, setBuyer] = useState(preselected ? 'existing' : 'walkin');
  const [customerSearch, setCustomerSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ fullName: '', email: '', phone: '' });
  const [walkInName, setWalkInName] = useState('');

  const [lines, setLines] = useState([emptyLine()]);
  const [shippingCost, setShippingCost] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
  const [payNow, setPayNow] = useState(true);
  const [amountPaid, setAmountPaid] = useState('');
  const [deliveredNow, setDeliveredNow] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    axiosInstance
      .get('/products?limit=200')
      .then(({ data }) => setProducts(data.products || data.data || []))
      .catch(() => toast.error('Could not load products'))
      .finally(() => setIsLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (!preselectedProduct || products.length === 0) return;

    setLines((current) =>
      current[0]?.product
        ? current
        : [
            {
              ...current[0],
              product: preselectedProduct,
              unitPrice: String(catalogPrice(preselectedProduct)),
            },
            ...current.slice(1),
          ]
    );
    // catalogPrice reads `products`, which is the dependency that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedProduct, products]);

  useEffect(() => {
    if (!preselected) return;

    axiosInstance
      .get(`/customers/${preselected}`)
      .then(({ data }) => setChosen(data.customer))
      .catch(() => toast.error('Could not load that customer'));
  }, [preselected]);

  // The catalog price, offered as a starting point. It is a default and not a
  // rule — the whole reason this screen exists is that the agreed price differs.
  const catalogPrice = (id) => {
    const product = products.find((item) => item._id === id);
    if (!product) return '';
    return product.isPromo && product.discountedPrice ? product.discountedPrice : product.price;
  };

  const setLine = (index, field, value) => {
    setLines((current) =>
      current.map((line, position) => {
        if (position !== index) return line;
        if (field !== 'product') return { ...line, [field]: value };
        // Choosing a product fills in its price, unless one has been typed.
        return {
          ...line,
          product: value,
          unitPrice: line.unitPrice === '' ? String(catalogPrice(value)) : line.unitPrice,
        };
      })
    );
  };

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (total, line) => total + Number(line.unitPrice || 0) * Number(line.quantity || 0),
        0
      ),
    [lines]
  );

  const estimate = subtotal + Number(shippingCost || 0);

  const findCustomers = async (event) => {
    event.preventDefault();
    if (!customerSearch.trim()) return;

    try {
      const { data } = await axiosInstance.get(
        `/customers?limit=10&search=${encodeURIComponent(customerSearch.trim())}`
      );
      setMatches(data.customers);
      if (data.customers.length === 0) toast('Nobody matched that.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not search customers');
    }
  };

  // The receipt is generated by the API and needs the session, so it is fetched
  // rather than linked — a bare href would arrive unauthenticated.
  const downloadReceipt = async (order) => {
    try {
      const { data } = await axiosInstance.get(`/orders/admin/${order._id}/receipt`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${order.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not build that receipt');
    }
  };

  const reset = () => {
    setLines([emptyLine()]);
    setShippingCost('');
    setCouponCode('');
    setAmountPaid('');
    setNotes('');
    setChosen(null);
    setMatches([]);
    setCustomerSearch('');
    setNewCustomer({ fullName: '', email: '', phone: '' });
    setWalkInName('');
  };

  const submit = async (event) => {
    event.preventDefault();

    const items = lines
      .filter((line) => line.product)
      .map((line) => ({
        product: line.product,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice === '' ? undefined : Number(line.unitPrice),
      }));

    if (items.length === 0) {
      toast.error('A sale needs at least one item.');
      return;
    }

    const body = {
      items,
      paymentMethod,
      shippingCost: Number(shippingCost || 0),
      couponCode: couponCode.trim() || null,
      notes: notes.trim() || null,
      deliveredNow,
      // Null means paid in full, which is what a counter sale usually is. Zero
      // means it walked out unpaid, which happens too and is a real state.
      amountPaid: payNow ? (amountPaid === '' ? null : Number(amountPaid)) : 0,
    };

    if (buyer === 'existing') {
      if (!chosen) {
        toast.error('Pick the customer, or record this as a walk-in.');
        return;
      }
      body.customerId = chosen._id;
    } else if (buyer === 'new') {
      if (!newCustomer.email.trim() || !newCustomer.fullName.trim()) {
        toast.error('A new customer needs a name and an email.');
        return;
      }
      body.customer = {
        fullName: newCustomer.fullName.trim(),
        email: newCustomer.email.trim(),
        phone: newCustomer.phone.trim() || null,
      };
    } else {
      body.customer = { fullName: walkInName.trim() || 'Walk-in customer' };
    }

    setIsSaving(true);

    try {
      const { data } = await axiosInstance.post('/orders/admin/sales', body);
      setDone(data);
      reset();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not record that sale');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Record a sale"
      subtitle="A sale made in the showroom, on the phone, or over WhatsApp"
    >
      <form onSubmit={submit} className="space-y-6">
        {/* ---------------------------------------------------------- buyer */}
        <section className="border border-base-300 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
            Who bought it
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { value: 'walkin', label: 'Walk-in' },
              { value: 'existing', label: 'A customer on record' },
              { value: 'new', label: 'Somebody new' },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={buyer === option.value ? 'secondary' : 'ghost'}
                onClick={() => setBuyer(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {buyer === 'walkin' && (
            <Input
              label="Name on the receipt"
              placeholder="Walk-in customer"
              value={walkInName}
              onChange={(event) => setWalkInName(event.target.value)}
              hint="No account is created — this is somebody who paid and left."
              wrapperClassName="max-w-md"
            />
          )}

          {buyer === 'existing' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  label="Find them"
                  icon={Search}
                  placeholder="Name, email or phone"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  wrapperClassName="max-w-sm"
                />
                <Button type="button" variant="secondary" onClick={findCustomers}>
                  Search
                </Button>
              </div>

              {chosen ? (
                <div className="flex items-center gap-3 border border-secondary bg-secondary/5 px-4 py-3">
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{chosen.username}</p>
                    <p className="text-neutral/50">{chosen.email}</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setChosen(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                matches.length > 0 && (
                  <ul className="divide-y divide-base-300 border border-base-300">
                    {matches.map((match) => (
                      <li key={match._id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-base-200"
                          onClick={() => setChosen(match)}
                        >
                          <span>
                            <span className="font-medium">{match.username}</span>
                            <span className="block text-xs text-neutral/50">{match.email}</span>
                          </span>
                          <span className="text-xs text-neutral/40">
                            {match.orderCount} order{match.orderCount === 1 ? '' : 's'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          )}

          {buyer === 'new' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Full name"
                value={newCustomer.fullName}
                onChange={(event) =>
                  setNewCustomer({ ...newCustomer, fullName: event.target.value })
                }
                required
              />
              <Input
                label="Email"
                type="email"
                value={newCustomer.email}
                onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })}
                required
              />
              <Input
                label="Phone"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })}
              />
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- lines */}
        <section className="border border-base-300 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
            What they bought
          </h2>

          {isLoadingProducts ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading products">
              {[1, 2, 3].map((index) => (
                <SkeletonBlock key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nothing to sell"
              description="A sale is made of catalogue items, and the catalogue is empty. Add a product first and it will appear here."
              actionLabel="Add a product"
              actionTo="/admin/products/new"
            />
          ) : (
          <>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <Select
                  value={line.product}
                  onChange={(event) => setLine(index, 'product', event.target.value)}
                  wrapperClassName="flex-1 min-w-[14rem]"
                >
                  <option value="">Choose a product</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} — {naira(catalogPrice(product._id))}
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
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price agreed"
                  value={line.unitPrice}
                  onChange={(event) => setLine(index, 'unitPrice', event.target.value)}
                  wrapperClassName="w-40"
                />
                <span className="pb-3 font-mono text-sm tabular-nums text-neutral/60">
                  {naira(Number(line.unitPrice || 0) * Number(line.quantity || 0))}
                </span>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    leftIcon={Trash2}
                    onClick={() => setLines(lines.filter((_, position) => position !== index))}
                  />
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            leftIcon={Plus}
            className="mt-2"
            onClick={() => setLines([...lines, emptyLine()])}
          >
            Add a line
          </Button>
          </>
          )}

          <p className="mt-3 border-t border-base-300 pt-3 text-xs text-neutral/50">
            The price is whatever was agreed. It starts at the catalog price and can be changed —
            that figure is what reaches the books, and the discount against list is visible in the
            margin report.
          </p>
        </section>

        {/* ---------------------------------------------------------- money */}
        <section className="border border-base-300 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
            Money
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Delivery charge"
              type="number"
              min="0"
              step="0.01"
              value={shippingCost}
              onChange={(event) => setShippingCost(event.target.value)}
            />
            <Input
              label="Coupon code"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              hint="Optional — validated the same way the website does."
            />
            <Select
              label="Paid by"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={payNow}
                onChange={(event) => setPayNow(event.target.checked)}
              />
              <span className="text-sm text-neutral">Money changed hands</span>
            </label>

            {payNow && (
              <Input
                label="Amount taken"
                type="number"
                min="0"
                step="0.01"
                placeholder={`${estimate.toFixed(2)} (in full)`}
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                hint="Leave blank for the full amount. A smaller figure leaves the rest owing."
                wrapperClassName="max-w-xs"
              />
            )}

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={deliveredNow}
                onChange={(event) => setDeliveredNow(event.target.checked)}
              />
              <span className="text-sm text-neutral">They took it with them</span>
            </label>
          </div>

          <Textarea
            label="Notes"
            className="mt-4"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything worth remembering about this sale"
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 border border-base-300 bg-white p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral/40">Estimated total</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{naira(estimate)}</p>
            <p className="text-xs text-neutral/40">
              Before any coupon and tax, which the server works out.
            </p>
          </div>
          <Button type="submit" leftIcon={Receipt} isLoading={isSaving} size="lg">
            Record the sale
          </Button>
        </div>
      </form>

      <Modal isOpen={Boolean(done)} onClose={() => setDone(null)} title="Sale recorded">
        {done && (
          <div className="space-y-4">
            <p className="text-sm text-neutral/70">{done.message}</p>

            <div className="border border-base-300 p-4">
              <p className="font-mono text-lg font-semibold">{done.order.orderNumber}</p>
              <p className="mt-1 text-sm text-neutral/60">
                {done.customer ? done.customer.name : 'Walk-in customer'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge status={done.order.status} />
                <Badge status={done.order.paymentStatus} />
                <span className="font-mono text-sm tabular-nums">
                  {naira(done.order.totalAmount)}
                </span>
              </div>
              {done.outstanding > 0 && (
                <p className="mt-3 text-sm text-error">
                  {naira(done.outstanding)} still owed on this order.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => downloadReceipt(done.order)}>
                Receipt
              </Button>
              <Button onClick={() => setDone(null)}>Record another</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default CounterSale;
