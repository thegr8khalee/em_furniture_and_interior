import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Package, Pencil, Receipt, TrendingUp } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, SkeletonBlock, Textarea } from '@em/ui';

/**
 * One product, on a page of its own.
 *
 * The catalogue could show a product and the inventory screen could show a
 * number, and nothing put the two together. "Why does it say nine?" was a
 * question with the answer in `stock_movements` and nowhere on screen — and
 * "what does it cost us" lived on a third page again.
 *
 * The stock balance is derived from the movements, so they are the explanation
 * of the figure rather than an audit trail beside it. That is why they are the
 * body of this page.
 */

const naira = (value) =>
  value === null || value === undefined
    ? '—'
    : `₦${Number(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

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

// What a movement means in words. `stock_movements.reason` is an enum and the
// raw value reads like a database column on a page an operator has to trust.
const REASONS = {
  purchase_receipt: { label: 'Bought in', tone: 'text-success' },
  sale: { label: 'Sold', tone: 'text-error' },
  return: { label: 'Returned', tone: 'text-success' },
  damage: { label: 'Damaged', tone: 'text-error' },
  adjustment: { label: 'Adjusted', tone: '' },
  transfer_in: { label: 'Moved in', tone: '' },
  transfer_out: { label: 'Moved out', tone: '' },
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

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [stock, setStock] = useState(null);
  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [adjustForm, setAdjustForm] = useState(null);
  const [costForm, setCostForm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const [position, history, catalogue] = await Promise.all([
        axiosInstance.get(`/inventory/admin/products/${productId}`),
        axiosInstance.get(`/inventory/admin/products/${productId}/history`),
        // The catalogue entry carries the selling price and the pictures, which
        // the stock view has no business knowing about.
        axiosInstance.get(`/products/${productId}`).catch(() => null),
      ]);

      setStock(position.data.product);
      setMovements(history.data.movements);
      // This route answers with the product itself rather than wrapping it.
      setProduct(catalogue?.data ?? null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that product');
      setStock(null);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdjust = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.put(`/inventory/admin/products/${productId}/adjust`, {
        delta: Number(adjustForm.delta),
        reason: adjustForm.reason,
      });

      toast.success('Recorded.');
      setAdjustForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not record that adjustment');
    } finally {
      setIsSaving(false);
    }
  };

  const submitCost = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.put(`/inventory/admin/products/${productId}/cost`, {
        costPrice: Number(costForm.costPrice),
      });

      toast.success('Cost price saved.');
      setCostForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save that cost');
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
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonBlock className="h-96 w-full lg:col-span-2" />
          <SkeletonBlock className="h-96 w-full" />
        </div>
      </AdminPageShell>
    );
  }

  if (!stock) {
    return (
      <AdminPageShell title="Product not found">
        <EmptyState
          icon={Package}
          title="No product with that id"
          description="It may have been deleted, or the link may be wrong."
          actionLabel="Back to products"
          actionTo="/admin/products"
        />
      </AdminPageShell>
    );
  }

  const price = product?.isPromo && product?.discountedPrice ? product.discountedPrice : product?.price;
  const margin =
    price && stock.costPrice ? Number(price) - Number(stock.costPrice) : null;
  const marginPct = margin !== null && Number(price) > 0 ? (margin / Number(price)) * 100 : null;

  return (
    <AdminPageShell
      title={stock.name}
      subtitle={stock.sku ? `SKU ${stock.sku}` : 'No SKU'}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/products">
            All products
          </Button>
          <Button
            variant="ghost"
            leftIcon={Receipt}
            onClick={() => navigate(`/admin/sales/new?product=${productId}`)}
          >
            Sell one
          </Button>
          <Button
            variant="secondary"
            leftIcon={Pencil}
            to={`/admin/products/edit/${productId}`}
          >
            Edit
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Available"
          value={stock.stockQuantity}
          hint={`${stock.onHand} on hand, ${stock.reserved} held for orders`}
          tone={stock.isLowStock ? 'text-error' : ''}
        />
        <Stat label="Sells for" value={naira(price)} hint={product?.isPromo ? 'On promotion' : ''} />
        <Stat
          label="Costs"
          value={naira(stock.costPrice)}
          hint={stock.costPrice === null ? 'No cost, so no margin is posted' : ''}
          tone={stock.costPrice === null ? 'text-error' : ''}
        />
        <Stat
          label="Margin"
          value={margin === null ? '—' : naira(margin)}
          hint={marginPct === null ? 'Needs a cost price' : `${marginPct.toFixed(1)}% of the price`}
        />
      </div>

      {stock.costPrice === null && (
        <div className="flex flex-wrap items-center gap-3 border border-error/30 bg-error/5 p-4">
          <AlertTriangle size={18} className="text-error" />
          <p className="flex-1 text-sm text-neutral/70">
            This product has no cost price, so selling it posts revenue and no cost of goods sold —
            every sale of it looks like pure profit in the books.
          </p>
          <Button
            variant="secondary"
            onClick={() => setCostForm({ costPrice: '' })}
          >
            Set the cost
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* The balance is derived from these, so they are the explanation of
              the figure rather than a log beside it. */}
          <Section
            title={`Stock movements (${movements.length})`}
            icon={TrendingUp}
            action={
              <Button
                variant="ghost"
                onClick={() => setAdjustForm({ delta: '', reason: '' })}
              >
                Adjust
              </Button>
            }
          >
            {movements.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nothing has moved"
                description="Stock arrives through a purchase order receipt or an adjustment, and leaves through a sale. Neither has happened to this product."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>What</th>
                      <th className="text-right">Change</th>
                      <th>Note</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const reason = REASONS[movement.reason] ?? { label: movement.reason, tone: '' };

                      return (
                        <tr key={movement._id}>
                          <td className="whitespace-nowrap text-sm">{moment(movement.createdAt)}</td>
                          <td className="text-sm">{reason.label}</td>
                          <td
                            className={`text-right font-mono tabular-nums ${
                              movement.delta < 0 ? 'text-error' : 'text-success'
                            }`}
                          >
                            {movement.delta > 0 ? '+' : ''}
                            {movement.delta}
                          </td>
                          <td className="text-sm text-neutral/60">{movement.note || '—'}</td>
                          <td className="text-sm text-neutral/50">{movement.adjustedBy || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="In the catalogue" icon={Package}>
            {product ? (
              <div className="space-y-3">
                {product.images?.[0] && (
                  <img
                    src={product.images[0].url || product.images[0]}
                    alt={stock.name}
                    className="h-40 w-full border border-base-300 object-cover"
                  />
                )}
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral/40">Category</dt>
                    <dd>{product.category || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral/40">Style</dt>
                    <dd>{product.style || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral/40">On promotion</dt>
                    <dd>{product.isPromo ? <Badge variant="warning">yes</Badge> : 'No'}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-neutral/40">
                The catalogue entry did not load. The stock figures above are still correct.
              </p>
            )}
          </Section>

          <Section title="Stock control">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Low-stock line</dt>
                <dd>
                  {stock.lowStockThreshold ?? 0}
                  {stock.isLowStock && (
                    <Badge variant="error" className="ml-2">
                      below it
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Kept at</dt>
                <dd>{stock.warehouseLocation || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Last touched</dt>
                <dd>{moment(stock.updatedAt)}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-base-300 pt-4">
              <Button
                variant="ghost"
                onClick={() => setCostForm({ costPrice: stock.costPrice ?? '' })}
              >
                Set cost price
              </Button>
              <Button variant="ghost" to="/admin/warehouse">
                Where it is
              </Button>
            </div>
          </Section>
        </div>
      </div>

      <Modal
        isOpen={Boolean(adjustForm)}
        onClose={() => setAdjustForm(null)}
        title="Adjust the count"
      >
        {adjustForm && (
          <form onSubmit={submitAdjust} className="space-y-4">
            <p className="text-sm text-neutral/60">
              This records the movement that explains the new figure, and the figure follows — so
              the balance is always something the movements add up to.
            </p>

            <Input
              label="Change"
              type="number"
              step="1"
              required
              placeholder="-2 for two lost, 5 for five found"
              value={adjustForm.delta}
              onChange={(event) => setAdjustForm({ ...adjustForm, delta: event.target.value })}
            />
            <Textarea
              label="Why"
              rows={2}
              required
              placeholder="Damaged in the workshop"
              value={adjustForm.reason}
              onChange={(event) => setAdjustForm({ ...adjustForm, reason: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setAdjustForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Record it
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(costForm)} onClose={() => setCostForm(null)} title="Cost price">
        {costForm && (
          <form onSubmit={submitCost} className="space-y-4">
            <p className="text-sm text-neutral/60">
              What this piece costs the business. A sale posts a cost of goods sold only if there is
              one, so this is the control that makes the profit and loss mean anything.
            </p>

            <Input
              label="Cost price"
              type="number"
              min="0"
              step="0.01"
              required
              value={costForm.costPrice}
              onChange={(event) => setCostForm({ ...costForm, costPrice: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setCostForm(null)}>
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

export default ProductDetail;
