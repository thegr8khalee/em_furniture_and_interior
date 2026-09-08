import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, ClipboardCheck, MapPin, Plus, ShoppingCart } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock, Textarea } from '@em/ui';

/**
 * Where the stock is, whether it is really there, and what to buy next.
 *
 * Three things that were missing from the same place: one free-text location
 * field for something that might sit in two places, corrections made one product
 * at a time when a count is one event, and two columns on every product —
 * threshold and lead time — that nothing had ever read.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const TABS = [
  { id: 'reorder', label: 'What to buy' },
  { id: 'stock', label: 'Where it is' },
  { id: 'takes', label: 'Stock takes' },
  { id: 'locations', label: 'Locations' },
];

const URGENCY = { late: 'error', soon: 'warning', idle: 'neutral', fine: 'success' };

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

const Warehouse = () => {
  const [tab, setTab] = useState('reorder');
  const [isLoading, setIsLoading] = useState(true);

  const [reorder, setReorder] = useState(null);
  const [stock, setStock] = useState([]);
  const [takes, setTakes] = useState([]);
  const [locations, setLocations] = useState([]);

  const [locationForm, setLocationForm] = useState(null);
  const [transferForm, setTransferForm] = useState(null);
  const [openTake, setOpenTake] = useState(null);
  const [counts, setCounts] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const loadLocations = useCallback(async () => {
    const { data } = await axiosInstance.get('/warehouse/locations');
    setLocations(data.locations);
    return data.locations;
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'reorder') {
        const { data } = await axiosInstance.get('/warehouse/reorder');
        setReorder(data);
      } else if (tab === 'stock') {
        const { data } = await axiosInstance.get('/warehouse/stock');
        setStock(data.stock);
        await loadLocations();
      } else if (tab === 'takes') {
        const { data } = await axiosInstance.get('/warehouse/stock-takes');
        setTakes(data.stockTakes);
        await loadLocations();
      } else {
        await loadLocations();
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that');
    } finally {
      setIsLoading(false);
    }
  }, [tab, loadLocations]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (request, message) => {
    try {
      const { data } = await request();
      toast.success(data.message || message);
      load();
      return data;
    } catch (error) {
      toast.error(error?.response?.data?.message || 'That did not work');
      return null;
    }
  };

  const openStockTake = async (take) => {
    try {
      const { data } = await axiosInstance.get(`/warehouse/stock-takes/${take._id}`);
      setOpenTake(data.stockTake);
      setCounts(
        Object.fromEntries(
          data.stockTake.lines.map((line) => [
            line.product._id,
            line.counted === null ? '' : String(line.counted),
          ])
        )
      );
    } catch (error) {
      toast.error('Could not load that count');
    }
  };

  const saveCounts = async () => {
    setIsSaving(true);
    try {
      // Only what was actually typed. A line left empty is one nobody has
      // counted yet, which is different from a line counted as zero.
      const entries = Object.entries(counts)
        .filter(([, value]) => value !== '')
        .map(([productId, value]) => ({ productId, counted: Number(value) }));

      const { data } = await axiosInstance.put(
        `/warehouse/stock-takes/${openTake._id}/counts`,
        { counts: entries }
      );
      toast.success(data.message);
      setOpenTake(data.stockTake);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save those counts');
    } finally {
      setIsSaving(false);
    }
  };

  const applyTake = async () => {
    if (
      !window.confirm(
        'Apply this count? One adjustment is written for each difference, and each one posts to the books.'
      )
    ) {
      return;
    }

    const data = await run(
      () => axiosInstance.post(`/warehouse/stock-takes/${openTake._id}/apply`),
      'Applied'
    );
    if (data) setOpenTake(null);
  };

  return (
    <AdminPageShell
      title="Warehouse"
      subtitle="Where the stock is, whether it is really there, and what to buy next"
      actions={
        tab === 'locations' ? (
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => setLocationForm({ name: '', address: '', isSellable: true })}
          >
            Add a location
          </Button>
        ) : tab === 'stock' ? (
          <Button
            variant="primary"
            leftIcon={ArrowRightLeft}
            onClick={() => setTransferForm({ product: '', from: '', to: '', quantity: 1 })}
          >
            Move stock
          </Button>
        ) : tab === 'takes' ? (
          <Button
            variant="primary"
            leftIcon={ClipboardCheck}
            onClick={async () => {
              const list = locations.length ? locations : await loadLocations();
              const target = list.find((l) => l.isDefault) ?? list[0];
              if (!target) return toast.error('Add a location first.');

              run(
                () => axiosInstance.post('/warehouse/stock-takes', { location: target._id }),
                'Count sheet opened'
              );
            }}
          >
            Start a count
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-1 border-b border-base-300">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'reorder' && reorder && (
            <Panel
              title="What to buy"
              description={`From what actually sold in the last ${reorder.window} days, against how long each thing takes to arrive`}
              actions={
                reorder.totals.late > 0 ? (
                  <Badge variant="error">{reorder.totals.late} already too late</Badge>
                ) : null
              }
            >
              {reorder.suggestions.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Nothing needs ordering"
                  description="Everything selling has enough cover for its lead time."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Available</th>
                        <th className="text-right">On order</th>
                        <th className="text-right">Selling</th>
                        <th className="text-right">Cover</th>
                        <th className="text-right">Lead time</th>
                        <th className="text-right">Order</th>
                        <th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorder.suggestions.map((row) => (
                        <tr key={row.product._id} className="hover">
                          <td>
                            <span className="font-medium">{row.product.name}</span>
                            <Badge variant={URGENCY[row.urgency]} className="ml-2">
                              {row.urgency === 'late'
                                ? 'will run out first'
                                : row.urgency === 'soon'
                                  ? 'order soon'
                                  : row.urgency === 'idle'
                                    ? 'low, but not selling'
                                    : 'fine'}
                            </Badge>
                          </td>
                          <td className="text-right">{row.available}</td>
                          <td className="text-right text-neutral/60">{row.onOrder || '—'}</td>
                          <td className="text-right text-sm text-neutral/60">
                            {row.dailyRate ? `${row.dailyRate}/day` : 'nothing'}
                          </td>
                          {/* Not "is it below the line" but "will it run out
                              before more arrives" — the honest question. */}
                          <td className="text-right">
                            {row.daysOfCover === null ? '—' : `${row.daysOfCover} days`}
                          </td>
                          <td className="text-right text-neutral/60">{row.leadTimeDays} days</td>
                          <td className="text-right font-semibold">{row.suggestedQuantity}</td>
                          <td className="text-right font-mono tabular-nums">
                            {row.estimatedCost === null ? '—' : naira(row.estimatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral font-semibold">
                        <td colSpan={7}>
                          {reorder.totals.products} to order
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(reorder.totals.estimatedCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'stock' && (
            <Panel title="Where it is" description="One row per product per place that holds any">
              {stock.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="Nothing anywhere"
                  description="Receive a purchase order and it will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Product</th>
                        <th>SKU</th>
                        <th className="text-right">On hand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((row, index) => (
                        <tr key={`${row.location._id}-${row.product._id}-${index}`} className="hover">
                          <td>
                            {row.location.name}
                            {!row.location.isSellable && (
                              <Badge variant="warning" className="ml-2">
                                not sellable
                              </Badge>
                            )}
                          </td>
                          <td className="font-medium">{row.product.name}</td>
                          <td className="text-sm text-neutral/60">{row.product.sku || '—'}</td>
                          <td className="text-right font-semibold">{row.onHand}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'takes' && (
            <Panel
              title="Stock takes"
              description="Counting everything in one place on one day, and explaining the differences"
            >
              {takes.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No counts yet"
                  description="A count freezes what the books expect, then records what is actually on the shelf."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Location</th>
                        <th className="text-right">Lines</th>
                        <th className="text-right">Counted</th>
                        <th className="text-right">Variance</th>
                        <th>Status</th>
                        <th className="text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {takes.map((take) => (
                        <tr key={take._id} className="hover">
                          <td className="whitespace-nowrap">{take.countedOn}</td>
                          <td>{take.location.name}</td>
                          <td className="text-right">{take.lineCount}</td>
                          <td className="text-right">{take.countedLines}</td>
                          <td
                            className={`text-right font-semibold ${
                              take.variance === 0
                                ? ''
                                : take.variance > 0
                                  ? 'text-success'
                                  : 'text-error'
                            }`}
                          >
                            {take.variance > 0 ? '+' : ''}
                            {take.variance}
                          </td>
                          <td>
                            <Badge
                              variant={
                                take.status === 'applied'
                                  ? 'success'
                                  : take.status === 'abandoned'
                                    ? 'neutral'
                                    : 'warning'
                              }
                            >
                              {take.status}
                            </Badge>
                          </td>
                          <td className="text-right">
                            <Button variant="ghost" onClick={() => openStockTake(take)}>
                              {take.status === 'counting' ? 'Count' : 'View'}
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

          {tab === 'locations' && (
            <Panel title="Locations" description="Where stock can be">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th className="text-right">Items held</th>
                      <th>Sellable</th>
                      <th className="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((location) => (
                      <tr key={location._id} className={location.isActive ? 'hover' : 'opacity-50'}>
                        <td>
                          <span className="font-medium">{location.name}</span>
                          {location.isDefault && (
                            <Badge variant="primary" className="ml-2">
                              default
                            </Badge>
                          )}
                        </td>
                        <td className="text-sm text-neutral/60">{location.address || '—'}</td>
                        <td className="text-right">{location.onHand ?? 0}</td>
                        <td>
                          {/* Stock in a container at the port is real and cannot
                              be promised to anybody. */}
                          <Badge variant={location.isSellable ? 'success' : 'warning'}>
                            {location.isSellable ? 'yes' : 'no'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" onClick={() => setLocationForm({ ...location })}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {/* --- the count sheet ---------------------------------------------- */}
      <Modal
        isOpen={Boolean(openTake)}
        onClose={() => setOpenTake(null)}
        title={openTake ? `Count · ${openTake.location.name} · ${openTake.countedOn}` : ''}
        className="max-w-4xl"
      >
        {openTake && (
          <div className="space-y-4">
            <p className="text-sm text-neutral/60">
              What the books expected was frozen when this sheet was drawn up, so a sale during the
              count cannot quietly change what you are checking against. A line left empty is one
              nobody has counted — it is left alone rather than written off.
            </p>

            <div className="max-h-[55vh] overflow-y-auto">
              <table className="table table-sm table-pin-rows w-full">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Expected</th>
                    <th className="text-right">Counted</th>
                    <th className="text-right">Variance</th>
                    <th className="text-right">Worth</th>
                  </tr>
                </thead>
                <tbody>
                  {openTake.lines.map((line) => {
                    const typed = counts[line.product._id];
                    const variance =
                      typed === '' || typed === undefined
                        ? null
                        : Number(typed) - line.expected;

                    return (
                      <tr key={line._id}>
                        <td>
                          {line.product.name}
                          {line.product.sku && (
                            <span className="block text-xs text-neutral/40">
                              {line.product.sku}
                            </span>
                          )}
                        </td>
                        <td className="text-right">{line.expected}</td>
                        <td className="text-right">
                          {openTake.status === 'counting' ? (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={typed ?? ''}
                              onChange={(event) =>
                                setCounts({ ...counts, [line.product._id]: event.target.value })
                              }
                              wrapperClassName="w-24 ml-auto"
                            />
                          ) : (
                            (line.counted ?? '—')
                          )}
                        </td>
                        <td
                          className={`text-right font-semibold ${
                            variance === null || variance === 0
                              ? ''
                              : variance > 0
                                ? 'text-success'
                                : 'text-error'
                          }`}
                        >
                          {variance === null ? '—' : variance > 0 ? `+${variance}` : variance}
                        </td>
                        <td className="text-right font-mono tabular-nums text-neutral/60">
                          {line.varianceValue === null ? '—' : naira(line.varianceValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {openTake.status === 'counting' && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    window.confirm('Abandon this count?') &&
                    run(
                      () => axiosInstance.post(`/warehouse/stock-takes/${openTake._id}/abandon`),
                      'Abandoned'
                    ).then(() => setOpenTake(null))
                  }
                >
                  Abandon
                </Button>
                <Button variant="secondary" onClick={saveCounts} disabled={isSaving}>
                  Save counts
                </Button>
                <Button variant="primary" onClick={applyTake}>
                  Apply
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* --- move stock --------------------------------------------------- */}
      <Modal
        isOpen={Boolean(transferForm)}
        onClose={() => setTransferForm(null)}
        title="Move stock"
        className="max-w-lg"
      >
        {transferForm && (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = await run(
                () => axiosInstance.post('/warehouse/transfers', transferForm),
                'Moved'
              );
              if (data) setTransferForm(null);
            }}
          >
            <p className="text-sm text-neutral/60">
              Two movements written together — out of one place and into the other — so a transfer
              can never leave stock nowhere. Nothing posts to the books: the value has not changed,
              only its address.
            </p>

            <Input
              label="Product id"
              required
              hint="From the stock list"
              value={transferForm.product}
              onChange={(e) => setTransferForm({ ...transferForm, product: e.target.value })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="From"
                required
                value={transferForm.from}
                onChange={(e) => setTransferForm({ ...transferForm, from: e.target.value })}
              >
                <option value="">Choose</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Select
                label="To"
                required
                value={transferForm.to}
                onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })}
              >
                <option value="">Choose</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="How many"
              type="number"
              min="1"
              step="1"
              required
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setTransferForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Move
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- a location --------------------------------------------------- */}
      <Modal
        isOpen={Boolean(locationForm)}
        onClose={() => setLocationForm(null)}
        title={locationForm?._id ? `Edit ${locationForm.name}` : 'Add a location'}
        className="max-w-lg"
      >
        {locationForm && (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = await run(
                () =>
                  locationForm._id
                    ? axiosInstance.patch(
                        `/warehouse/locations/${locationForm._id}`,
                        locationForm
                      )
                    : axiosInstance.post('/warehouse/locations', locationForm),
                'Saved'
              );
              if (data) setLocationForm(null);
            }}
          >
            <Input
              label="Name"
              required
              value={locationForm.name ?? ''}
              onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
            />
            <Textarea
              label="Address"
              rows={2}
              value={locationForm.address ?? ''}
              onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
            />

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={locationForm.isSellable ?? true}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, isSellable: e.target.checked })
                }
              />
              <span className="text-sm text-neutral">
                Stock here can be sold — untick for a container at the port
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setLocationForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Warehouse;
