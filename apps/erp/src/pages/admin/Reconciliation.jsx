import { useCallback, useEffect, useState } from 'react';
import { Check, Link2, Scale, Upload } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock, Textarea } from '@em/ui';

/**
 * Does the bank agree?
 *
 * The ledger says what the business thinks it has; the bank says what it
 * actually has. The two drift for ordinary reasons — a transfer entered twice, a
 * charge nobody recorded, a payment that arrived quietly — and a cash figure
 * nobody has checked against a statement is a guess with a decimal point.
 *
 * The two unmatched columns are the whole screen. Everything already agreed is
 * shown faintly, because it is only there so the totals add up; what is left
 * over is the work.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const ACCOUNTS = [
  { code: '1120', label: 'Bank — current account' },
  { code: '1110', label: 'Bank — Paystack' },
  { code: '1130', label: 'Cash on hand' },
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

const Reconciliation = () => {
  const [account, setAccount] = useState('1120');
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState(null);

  const [picked, setPicked] = useState({ line: null, entry: null });
  const [importing, setImporting] = useState(null);
  const [signOff, setSignOff] = useState(null);
  // Every reconciliation that has been signed off. The whole reason they are
  // stored is so the next one can start where the last finished rather than
  // re-checking the account from the beginning of time — and nothing showed
  // them, so nobody could tell when this account was last agreed.
  const [history, setHistory] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [workspace, signed] = await Promise.all([
        axiosInstance.get(`/reconciliation?account=${account}`),
        axiosInstance.get(`/reconciliation/history?account=${account}`).catch(() => null),
      ]);

      setView(workspace.data);
      setHistory(signed?.data?.reconciliations ?? []);
      setPicked({ line: null, entry: null });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load the reconciliation');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const match = async (lineId, entryId) => {
    try {
      await axiosInstance.post(`/reconciliation/lines/${lineId}/match`, { entryId });
      toast.success('Matched');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Those do not go together');
    }
  };

  const unmatch = async (lineId) => {
    try {
      await axiosInstance.delete(`/reconciliation/lines/${lineId}/match`);
      toast.success('Unmatched');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not unmatch that');
    }
  };

  // Suggests rather than matches: two payments of the same amount in the same
  // week are common, and a wrong match agrees a balance that was never true.
  const suggest = async () => {
    try {
      const { data } = await axiosInstance.get(`/reconciliation/suggestions?account=${account}`);

      if (data.suggestions.length === 0) {
        toast('Nothing obvious to suggest.');
        return;
      }

      const summary = data.suggestions
        .slice(0, 10)
        .map((s) => `${s.line.date}  ${naira(s.amount)}  ${s.entry.entryNumber}`)
        .join('\n');

      if (
        window.confirm(
          `${data.suggestions.length} likely matches — same amount, same direction, within a few days:\n\n${summary}\n\nAccept them all?`
        )
      ) {
        for (const suggestion of data.suggestions) {
          await axiosInstance
            .post(`/reconciliation/lines/${suggestion.lineId}/match`, {
              entryId: suggestion.entryId,
            })
            .catch(() => {});
        }
        toast.success(`Matched ${data.suggestions.length}`);
        load();
      }
    } catch (error) {
      toast.error('Could not work out any suggestions');
    }
  };

  const submitImport = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      // One line per row: date, description, in, out. What a bank's CSV export
      // looks like once the headings are taken off.
      const lines = importing.text
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const [date, description, moneyIn, moneyOut] = row.split(',').map((c) => c?.trim());
          const inAmount = Number(moneyIn || 0);
          const outAmount = Number(moneyOut || 0);

          return {
            date,
            description: description || 'Bank line',
            amount: inAmount || outAmount,
            direction: inAmount ? 'in' : 'out',
          };
        })
        .filter((line) => line.date && line.amount);

      if (lines.length === 0) {
        toast.error('Nothing there to import.');
        return;
      }

      const { data } = await axiosInstance.post('/reconciliation/statement', {
        account,
        lines,
      });

      toast.success(data.message);
      setImporting(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not import that');
    } finally {
      setIsSaving(false);
    }
  };

  const submitSignOff = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.post('/reconciliation/complete', {
        account,
        statementDate: signOff.statementDate,
        statementBalance: Number(signOff.statementBalance),
        notes: signOff.notes || null,
      });

      toast.success(data.message);
      setSignOff(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'It does not reconcile yet');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Bank reconciliation"
      subtitle="What the books say against what the bank says, and what explains the difference"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" leftIcon={Link2} onClick={suggest}>
            Suggest matches
          </Button>
          <Button
            variant="ghost"
            leftIcon={Upload}
            onClick={() => setImporting({ text: '' })}
          >
            Import a statement
          </Button>
          <Button
            variant="primary"
            leftIcon={Check}
            onClick={() =>
              setSignOff({
                statementDate: new Date().toISOString().slice(0, 10),
                statementBalance: '',
                notes: '',
              })
            }
          >
            Sign it off
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-4 border border-base-300 bg-white p-5">
        <Select
          label="Account"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          wrapperClassName="max-w-sm"
        >
          {ACCOUNTS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code} · {option.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading || !view ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="border border-base-300 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
                The books say
              </p>
              <p className="mt-2 font-mono text-xl font-bold">{naira(view.ledgerBalance)}</p>
            </div>
            <div className="border border-base-300 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
                Imported lines come to
              </p>
              <p className="mt-2 font-mono text-xl font-bold">{naira(view.importedBalance)}</p>
            </div>
            <div className="border border-base-300 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
                On the bank, not in the books
              </p>
              <p className="mt-2 font-mono text-xl font-bold">
                {naira(view.unmatched.unrecorded)}
              </p>
              <p className="mt-1 text-xs text-neutral/40">
                {view.unmatched.statement.length} lines
              </p>
            </div>
            <div className="border border-base-300 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
                In the books, not on the bank
              </p>
              <p className="mt-2 font-mono text-xl font-bold">
                {naira(view.unmatched.unpresented)}
              </p>
              <p className="mt-1 text-xs text-neutral/40">
                {view.unmatched.ledger.length} entries
              </p>
            </div>
          </div>

          {/* Pick one from each side and match them. The API refuses a pair
              whose amounts or directions disagree. */}
          {picked.line && picked.entry && (
            <div className="flex items-center justify-between border border-secondary bg-secondary/5 p-4">
              <span className="text-sm text-neutral">
                Match the bank line to {picked.entry.entryNumber}?
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPicked({ line: null, entry: null })}
                >
                  Clear
                </Button>
                <Button
                  variant="primary"
                  onClick={() => match(picked.line._id, picked.entry._id)}
                >
                  Match
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="The bank"
              description="Lines from the statement. Unmatched ones are things the books have not heard about."
            >
              {view.statement.length === 0 ? (
                <EmptyState
                  icon={Upload}
                  title="No statement imported"
                  description="Paste the lines from your bank's export to begin."
                />
              ) : (
                <table className="table table-sm w-full">
                  <tbody>
                    {view.statement.map((line) => (
                      <tr
                        key={line._id}
                        className={
                          line.isMatched
                            ? 'opacity-40'
                            : `cursor-pointer hover ${
                                picked.line?._id === line._id ? 'bg-secondary/10' : ''
                              }`
                        }
                        onClick={() =>
                          !line.isMatched && setPicked({ ...picked, line })
                        }
                      >
                        <td className="whitespace-nowrap text-sm">{line.date}</td>
                        <td className="text-sm">{line.description}</td>
                        <td
                          className={`text-right font-mono tabular-nums ${
                            line.direction === 'in' ? 'text-success' : 'text-error'
                          }`}
                        >
                          {line.direction === 'in' ? '+' : '−'}
                          {naira(line.amount)}
                        </td>
                        <td className="w-24 text-right">
                          {line.isMatched && (
                            <Button variant="ghost" onClick={() => unmatch(line._id)}>
                              Unmatch
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel
              title="The books"
              description="Postings that touched this account. Unmatched ones are money the bank has not seen."
            >
              <table className="table table-sm w-full">
                <tbody>
                  {view.ledger.map((line) => (
                    <tr
                      key={line._id}
                      className={
                        line.isMatched
                          ? 'opacity-40'
                          : `cursor-pointer hover ${
                              picked.entry?._id === line._id ? 'bg-secondary/10' : ''
                            }`
                      }
                      onClick={() => !line.isMatched && setPicked({ ...picked, entry: line })}
                    >
                      <td className="whitespace-nowrap text-sm">{line.date}</td>
                      <td className="font-mono text-xs">{line.entryNumber}</td>
                      <td className="text-sm">{line.description}</td>
                      <td
                        className={`text-right font-mono tabular-nums ${
                          Number(line.movement) > 0 ? 'text-success' : 'text-error'
                        }`}
                      >
                        {naira(line.movement)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </>
      )}

      {/* --- import ------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(importing)}
        onClose={() => setImporting(null)}
        title="Import a statement"
        className="max-w-2xl"
      >
        {importing && (
          <form onSubmit={submitImport} className="space-y-4">
            <p className="text-sm text-neutral/60">
              One line per row, comma separated: <strong>date, description, in, out</strong>. Leave
              the column that does not apply empty. Importing the same statement twice cannot
              double it up when your bank supplies its own reference.
            </p>

            <Textarea
              label="Lines"
              rows={12}
              required
              placeholder={'2026-09-01, Transfer from Ada Obi, 110000,\n2026-09-02, Bank charge, , 1500'}
              value={importing.text}
              onChange={(event) => setImporting({ text: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setImporting(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Import
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- sign off ----------------------------------------------------- */}
      <Modal
        isOpen={Boolean(signOff)}
        onClose={() => setSignOff(null)}
        title="Sign off the reconciliation"
        className="max-w-lg"
      >
        {signOff && (
          <form onSubmit={submitSignOff} className="space-y-4">
            <p className="text-sm text-neutral/60">
              Type the balance from the statement itself, not from what was imported — the point is
              to check the books against something outside them. It is refused unless the two
              agree once the outstanding items on both sides are taken into account.
            </p>

            <Input
              label="Statement date"
              type="date"
              required
              value={signOff.statementDate}
              onChange={(event) => setSignOff({ ...signOff, statementDate: event.target.value })}
            />
            <Input
              label="What the bank says the balance is (₦)"
              type="number"
              step="0.01"
              required
              value={signOff.statementBalance}
              onChange={(event) =>
                setSignOff({ ...signOff, statementBalance: event.target.value })
              }
            />
            <Textarea
              label="Notes"
              rows={2}
              value={signOff.notes}
              onChange={(event) => setSignOff({ ...signOff, notes: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setSignOff(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Sign off
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* When this account was last agreed with the bank, and what it came to. */}
      <section className="border border-base-300 bg-white p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/60">
          Signed off
        </h2>

        {history.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Never reconciled"
            description="This account has not been agreed with a bank statement yet. Until it is, the cash figure in the books is a number nobody has checked against anything outside them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Statement date</th>
                  <th className="text-right">Bank said</th>
                  <th className="text-right">Books said</th>
                  <th className="text-right">Not yet on the bank</th>
                  <th className="text-right">Not yet in the books</th>
                  <th>Signed off by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry._id}>
                    <td className="whitespace-nowrap font-medium">{entry.statementDate}</td>
                    <td className="text-right font-mono tabular-nums">
                      {naira(entry.statementBalance)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {naira(entry.ledgerBalance)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-neutral/60">
                      {naira(entry.unpresented)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-neutral/60">
                      {naira(entry.unrecorded)}
                    </td>
                    <td className="text-sm text-neutral/60">{entry.completedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
};

export default Reconciliation;
