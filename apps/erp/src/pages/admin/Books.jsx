import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Lock,
  LockOpen,
} from 'lucide-react';
import { axiosInstance, useAuthStore } from '@em/domain';
import { PERMISSIONS } from '@em/shared/permissions';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * The books.
 *
 * Everything on this screen comes from `journal_lines` by way of `/api/books`.
 * Nothing here recomputes a figure from orders or payments, which is what makes
 * these reports and the postings incapable of disagreeing — a number that looks
 * wrong points at a posting rule, not at this page.
 *
 * The console had one finance screen before this, and it summed the orders
 * table: a sales report, which cannot express a cost, a liability or a bank
 * balance. This is the screen the ledger was built for.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/** A figure the reader has to be able to scan a column of, so it is monospaced. */
const Money = ({ value, className = '' }) => (
  <span className={`font-mono tabular-nums ${className}`}>{naira(value)}</span>
);

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const TABS = [
  { id: 'trial-balance', label: 'Trial balance' },
  { id: 'profit-and-loss', label: 'Profit & loss' },
  { id: 'balance-sheet', label: 'Balance sheet' },
  { id: 'vat', label: 'VAT return' },
  { id: 'journal', label: 'Journal' },
  { id: 'periods', label: 'Periods' },
];

/** A report either balances or it does not, and the reader should not have to add it up. */
const BalanceFlag = ({ balanced }) =>
  balanced ? (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-success">
      <CheckCircle2 size={16} /> In balance
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-error">
      <AlertTriangle size={16} /> Out of balance — a posting rule is wrong
    </span>
  );

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

/** One block of a report: a heading, its lines, and what they come to. */
const ReportSection = ({ heading, lines = [], total, onPickAccount, emphasis = false }) => (
  <div className="mb-6 last:mb-0">
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/50">
      {heading}
    </h3>
    <table className="table table-sm w-full">
      <tbody>
        {lines.length === 0 ? (
          <tr>
            <td className="text-sm text-neutral/40" colSpan={2}>
              Nothing posted
            </td>
          </tr>
        ) : (
          lines.map((line) => (
            <tr key={line.code}>
              <td>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => onPickAccount?.(line.code)}
                >
                  <span className="font-mono text-xs text-neutral/50">{line.code}</span>{' '}
                  {line.name}
                </button>
              </td>
              <td className="text-right">
                <Money value={line.amount} />
              </td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className={emphasis ? 'border-t-2 border-neutral' : 'border-t border-base-300'}>
          <td className="font-semibold text-neutral">Total {heading.toLowerCase()}</td>
          <td className="text-right font-semibold text-neutral">
            <Money value={total} />
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
);

const Books = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission?.(PERMISSIONS.BOOKS_MANAGE);

  const [tab, setTab] = useState('trial-balance');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [asOf, setAsOf] = useState(today());

  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState(null);

  // The journal has its own filters; the reports share the range above.
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);

  // Clicking any account code anywhere opens its ledger over the page.
  const [ledgerCode, setLedgerCode] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [entry, setEntry] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const range = `from=${from}&to=${to}`;

      if (tab === 'trial-balance') {
        const { data } = await axiosInstance.get(`/books/trial-balance?asOf=${asOf}`);
        setReport(data);
      } else if (tab === 'profit-and-loss') {
        const { data } = await axiosInstance.get(`/books/reports/profit-and-loss?${range}`);
        setReport(data);
      } else if (tab === 'balance-sheet') {
        const { data } = await axiosInstance.get(`/books/reports/balance-sheet?asOf=${asOf}`);
        setReport(data);
      } else if (tab === 'vat') {
        const { data } = await axiosInstance.get(`/books/reports/vat?${range}`);
        setReport(data);
      } else if (tab === 'journal') {
        const query = `${range}&page=${page}&limit=50${source ? `&source=${source}` : ''}`;
        const { data } = await axiosInstance.get(`/books/journal?${query}`);
        setReport(data);
      } else if (tab === 'periods') {
        const { data } = await axiosInstance.get('/books/periods');
        setReport(data);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load the books');
    } finally {
      setIsLoading(false);
    }
  }, [tab, from, to, asOf, source, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openLedger = async (code) => {
    setLedgerCode(code);
    setLedger(null);
    try {
      const { data } = await axiosInstance.get(`/books/accounts/${code}/ledger?from=${from}&to=${to}`);
      setLedger(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that account');
      setLedgerCode(null);
    }
  };

  const openEntry = async (entryId) => {
    setEntry(null);
    try {
      const { data } = await axiosInstance.get(`/books/journal/${entryId}`);
      setEntry(data.entry);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that entry');
    }
  };

  const changePeriod = async (period, action) => {
    const verb = action === 'close' ? 'Close' : 'Reopen';
    if (!window.confirm(`${verb} ${period.name}? Closing stops any further posting into it.`)) {
      return;
    }

    try {
      await axiosInstance.post(`/books/periods/${period._id}/${action}`);
      toast.success(`${period.name} ${action === 'close' ? 'closed' : 'reopened'}`);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Could not ${action} that month`);
    }
  };

  const usesRange = tab === 'profit-and-loss' || tab === 'vat' || tab === 'journal';
  const usesAsOf = tab === 'trial-balance' || tab === 'balance-sheet';

  return (
    <AdminPageShell
      title="Books"
      subtitle="Everything here is read from the ledger, so the reports and the postings cannot disagree"
    >
      <div className="flex flex-wrap gap-1 border-b border-base-300">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setReport(null);
              setPage(1);
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

      {(usesRange || usesAsOf) && (
        <div className="flex flex-wrap items-end gap-4 border border-base-300 bg-white p-5">
          {usesAsOf ? (
            <Input
              label="As at"
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          ) : (
            <>
              <Input
                label="From"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </>
          )}

          {tab === 'journal' && (
            <Select
              label="Source"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Everything</option>
              <option value="order">Orders</option>
              <option value="payment">Payments</option>
              <option value="stock_movement">Stock</option>
              <option value="expense">Expenses</option>
              <option value="expense_payment">Expense payments</option>
              <option value="manual">Manual</option>
            </Select>
          )}
        </div>
      )}

      {isLoading || !report ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'trial-balance' && (
            <Panel
              title="Trial balance"
              description="Every account with a balance, as at the date above"
              actions={<BalanceFlag balanced={report.balanced} />}
            >
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.accounts.map((account) => (
                      <tr key={account.code} className="hover">
                        <td>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => openLedger(account.code)}
                          >
                            <span className="font-mono text-xs text-neutral/50">
                              {account.code}
                            </span>{' '}
                            {account.name}
                          </button>
                        </td>
                        <td className="text-right">
                          <Money value={account.debit} />
                        </td>
                        <td className="text-right">
                          <Money value={account.credit} />
                        </td>
                        <td className="text-right font-semibold">
                          <Money value={account.balance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral font-semibold text-neutral">
                      <td>Totals</td>
                      <td className="text-right">
                        <Money value={report.totalDebit} />
                      </td>
                      <td className="text-right">
                        <Money value={report.totalCredit} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          )}

          {tab === 'profit-and-loss' && (
            <Panel title={`Profit and loss — ${report.from} to ${report.to}`}>
              <ReportSection
                heading="Revenue"
                lines={report.revenue.lines}
                total={report.revenue.total}
                onPickAccount={openLedger}
              />
              <ReportSection
                heading="Cost of sales"
                lines={report.costOfSales.lines}
                total={report.costOfSales.total}
                onPickAccount={openLedger}
              />

              <div className="mb-6 flex items-center justify-between border-y-2 border-neutral py-3">
                <span className="font-heading text-base font-semibold text-neutral">
                  Gross profit
                </span>
                <Money value={report.grossProfit} className="text-lg font-semibold" />
              </div>

              <ReportSection
                heading="Operating expenses"
                lines={report.operatingExpenses.lines}
                total={report.operatingExpenses.total}
                onPickAccount={openLedger}
              />

              <div
                className={`flex items-center justify-between border-y-2 py-3 ${
                  Number(report.netProfit) < 0 ? 'border-error text-error' : 'border-neutral'
                }`}
              >
                <span className="font-heading text-lg font-bold">Net profit</span>
                <Money value={report.netProfit} className="text-xl font-bold" />
              </div>
            </Panel>
          )}

          {tab === 'balance-sheet' && (
            <Panel
              title={`Balance sheet as at ${report.asOf}`}
              actions={<BalanceFlag balanced={report.balanced} />}
            >
              <div className="grid gap-8 lg:grid-cols-2">
                <ReportSection
                  heading="Assets"
                  lines={report.assets.lines}
                  total={report.assets.total}
                  onPickAccount={openLedger}
                  emphasis
                />
                <div>
                  <ReportSection
                    heading="Liabilities"
                    lines={report.liabilities.lines}
                    total={report.liabilities.total}
                    onPickAccount={openLedger}
                  />
                  {/* Retained earnings are computed here rather than posted, so the
                      sheet balances without anyone having made a year-end entry. */}
                  <ReportSection
                    heading="Equity"
                    lines={report.equity.lines}
                    total={report.equity.total}
                    onPickAccount={openLedger}
                    emphasis
                  />
                </div>
              </div>
            </Panel>
          )}

          {tab === 'vat' && (
            <Panel title={`VAT return — ${report.from} to ${report.to}`}>
              <div className="stats stats-vertical w-full border border-base-300 lg:stats-horizontal">
                <div className="stat">
                  <div className="stat-title">Taxable sales</div>
                  <div className="stat-value text-2xl">{naira(report.taxableSales)}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Output VAT charged</div>
                  <div className="stat-value text-2xl">{naira(report.outputVat)}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Input VAT paid</div>
                  <div className="stat-value text-2xl">{naira(report.inputVat)}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">
                    {Number(report.netPayable) < 0 ? 'Reclaimable' : 'Payable to FIRS'}
                  </div>
                  <div
                    className={`stat-value text-2xl ${
                      Number(report.netPayable) < 0 ? 'text-success' : 'text-primary'
                    }`}
                  >
                    {naira(Math.abs(Number(report.netPayable)))}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-neutral/50">
                Output VAT is what was charged to customers; input VAT is what approved expenses
                paid to suppliers. The difference is what is owed.
              </p>
            </Panel>
          )}

          {tab === 'journal' && (
            <Panel
              title="Journal"
              description={`${report.pagination.total} entries`}
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-neutral/50">
                    {page} / {Math.max(report.pagination.pages, 1)}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={page >= report.pagination.pages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              }
            >
              {report.entries.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Nothing posted in this window"
                  description="Confirm an order or approve an expense and it will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Entry</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Source</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.entries.map((row) => (
                        <tr
                          key={row._id}
                          className="hover cursor-pointer"
                          onClick={() => openEntry(row._id)}
                        >
                          <td className="font-mono text-xs">{row.entryNumber}</td>
                          <td className="whitespace-nowrap">{row.date}</td>
                          <td>
                            {row.description}
                            {row.reversedById && (
                              <Badge variant="warning" className="ml-2">
                                Reversed
                              </Badge>
                            )}
                          </td>
                          <td>
                            <span className="text-xs uppercase tracking-wide text-neutral/50">
                              {String(row.source).replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="text-right">
                            <Money value={row.total} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'periods' && (
            <Panel
              title="Accounting calendar"
              description={
                canManage
                  ? 'Closing a month stops any further posting into it.'
                  : 'Only the owner can close or reopen a month.'
              }
            >
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Covers</th>
                      <th>Entries</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.periods.map((period) => (
                      <tr key={period._id} className="hover">
                        <td className="font-medium">{period.name}</td>
                        <td className="whitespace-nowrap text-sm text-neutral/50">
                          {period.startsOn} → {period.endsOn}
                        </td>
                        <td>{period.entryCount ?? 0}</td>
                        <td>
                          <Badge variant={period.status === 'closed' ? 'neutral' : 'success'}>
                            {period.status}
                          </Badge>
                        </td>
                        <td className="text-right">
                          {canManage && (
                            <Button
                              variant="ghost"
                              leftIcon={period.status === 'closed' ? LockOpen : Lock}
                              onClick={() =>
                                changePeriod(period, period.status === 'closed' ? 'reopen' : 'close')
                              }
                            >
                              {period.status === 'closed' ? 'Reopen' : 'Close'}
                            </Button>
                          )}
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

      {/* One account's history, with a running balance. Reached by clicking any
          account code on any report, because "why is this number that?" is the
          question every report provokes. */}
      <Modal
        isOpen={Boolean(ledgerCode)}
        onClose={() => setLedgerCode(null)}
        title={ledger ? `${ledger.account.code} · ${ledger.account.name}` : 'Loading…'}
        className="max-w-4xl"
      >
        {!ledger ? (
          <SkeletonBlock className="h-48 w-full" />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
              <span className="text-neutral/50">
                Opening <Money value={ledger.openingBalance} className="text-neutral" />
              </span>
              <span className="text-neutral/50">
                Closing{' '}
                <Money value={ledger.closingBalance} className="font-semibold text-neutral" />
              </span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="table table-sm table-pin-rows w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.lines.map((line, index) => (
                    <tr key={`${line.entryNumber}-${index}`}>
                      <td className="whitespace-nowrap">{line.date}</td>
                      <td className="font-mono text-xs">{line.entryNumber}</td>
                      <td>{line.description}</td>
                      <td className="text-right">
                        {Number(line.debit) ? <Money value={line.debit} /> : null}
                      </td>
                      <td className="text-right">
                        {Number(line.credit) ? <Money value={line.credit} /> : null}
                      </td>
                      <td className="text-right font-medium">
                        <Money value={line.balance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      {/* One entry and both its sides, which is the only way to see that it balances. */}
      <Modal
        isOpen={Boolean(entry)}
        onClose={() => setEntry(null)}
        title={entry ? `${entry.entryNumber} · ${entry.description}` : ''}
      >
        {entry && (
          <>
            <p className="mb-4 text-sm text-neutral/50">
              {entry.date} · {String(entry.source).replace(/_/g, ' ')}
              {entry.createdByName ? ` · posted by ${entry.createdByName}` : ''}
            </p>
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line, index) => (
                  <tr key={`${line.account}-${index}`}>
                    <td>
                      <span className="font-mono text-xs text-neutral/50">{line.account}</span>{' '}
                      {line.accountName}
                      {line.description && (
                        <span className="block text-xs text-neutral/40">{line.description}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {Number(line.debit) ? <Money value={line.debit} /> : null}
                    </td>
                    <td className="text-right">
                      {Number(line.credit) ? <Money value={line.credit} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Books;
