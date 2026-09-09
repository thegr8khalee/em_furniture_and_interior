import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Mail, Send } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, SkeletonBlock } from '@em/ui';

/**
 * The statement run.
 *
 * Everyone with something outstanding, in one list. The receivables ageing in
 * the books answers the owner's question — who owes us, and for how long. This
 * answers the next one: who has to be sent something about it today.
 *
 * Sending statements one at a time is how they stop being sent, which is why
 * this exists as a page and not as a button on each customer.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

// How old the oldest unpaid thing is. A debt sitting in 90+ is a different
// conversation from one raised last week, and the wording of the chase follows
// from which bucket it is in.
const BUCKETS = {
  current: { label: 'Current', variant: 'success' },
  30: { label: '30 days', variant: 'info' },
  60: { label: '60 days', variant: 'warning' },
  '90+': { label: '90+ days', variant: 'error' },
};

const Stat = ({ label, value, hint }) => (
  <div className="border border-base-300 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">{label}</p>
    <p className="mt-2 font-heading text-2xl font-bold text-neutral">{value}</p>
    {hint && <p className="mt-1 text-xs text-neutral/40">{hint}</p>}
  </div>
);

const Statements = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [run, setRun] = useState(null);
  const [asOf, setAsOf] = useState('');
  // Which ones an operator has dealt with in this sitting. Deliberately not
  // saved: it is a tick sheet for one pass down the list, not a record of what
  // was sent — claiming a statement went out when nothing tracked it would be
  // worse than not claiming anything.
  const [done, setDone] = useState(() => new Set());

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = asOf ? `?asOf=${asOf}` : '';
      const { data } = await axiosInstance.get(`/statements/run${params}`);
      setRun(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not build the run');
      setRun(null);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (customer) => {
    try {
      const { data } = await axiosInstance.get(`/statements/customers/${customer.customerId}.csv`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement-${String(customer.name).replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setDone((current) => new Set(current).add(customer.customerId));
    } catch {
      toast.error('Could not export that statement');
    }
  };

  const mailTo = (customer) => {
    if (!customer.email) {
      toast.error(`${customer.name} has no email on record.`);
      return;
    }

    const subject = `Statement of account — ${naira(customer.total)} outstanding`;
    const body = [
      `Dear ${customer.name},`,
      '',
      `Please find the balance on your account below as at ${run.asOf}.`,
      '',
      `Amount outstanding: ${naira(customer.total)}`,
      '',
      'Thank you,',
      'EM Furniture and Interior',
    ].join('\n');

    window.location.href = `mailto:${customer.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setDone((current) => new Set(current).add(customer.customerId));
  };

  const outstanding = run?.customers ?? [];
  const oldest = outstanding.filter((row) => row.oldest === '90+').length;

  return (
    <AdminPageShell
      title="Statements"
      subtitle="Everyone with something outstanding, so the chasing happens in one pass"
      actions={
        <Input
          label="As at"
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          wrapperClassName="w-44"
        />
      }
    >
      {isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <SkeletonBlock key={index} className="h-24 w-full" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((index) => (
              <SkeletonBlock key={index} className="h-16 w-full" />
            ))}
          </div>
        </>
      ) : outstanding.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nobody owes anything"
          description={
            run
              ? `Every account was settled as at ${run.asOf}. Nothing needs chasing today.`
              : 'Nothing outstanding.'
          }
          actionLabel="Open the books"
          actionTo="/admin/books"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat
              label="Outstanding"
              value={naira(run.total)}
              hint={`across ${outstanding.length} account${outstanding.length === 1 ? '' : 's'}`}
            />
            <Stat
              label="Over 90 days"
              value={oldest}
              hint={oldest ? 'These are the ones to ring, not email' : 'Nothing has gone stale'}
            />
            <Stat
              label="Dealt with"
              value={`${done.size} / ${outstanding.length}`}
              hint="This sitting only — it is a tick sheet, not a record"
            />
          </div>

          <div className="border border-base-300 bg-white">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Oldest</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">Send</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((customer) => {
                    const bucket = BUCKETS[customer.oldest] ?? BUCKETS.current;

                    return (
                      <tr
                        key={customer.customerId}
                        className={done.has(customer.customerId) ? 'opacity-50' : ''}
                      >
                        <td>
                          <button
                            type="button"
                            className="font-medium hover:text-secondary"
                            onClick={() => navigate(`/admin/customers/${customer.customerId}`)}
                          >
                            {customer.name}
                          </button>
                        </td>
                        <td className="text-sm text-neutral/60">{customer.email || '—'}</td>
                        <td>
                          <Badge variant={bucket.variant}>{bucket.label}</Badge>
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(customer.total)}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={Download}
                              onClick={() => download(customer)}
                              title="Download the statement"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={Mail}
                              onClick={() => mailTo(customer)}
                              title="Draft an email about it"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 px-5 py-3 text-sm text-neutral/50">
              <span className="flex items-center gap-2">
                <Send size={14} />
                Downloading or drafting ticks a row off. Nothing is sent for you.
              </span>
              <span>As at {run.asOf}</span>
            </div>
          </div>
        </>
      )}
    </AdminPageShell>
  );
};

export default Statements;
