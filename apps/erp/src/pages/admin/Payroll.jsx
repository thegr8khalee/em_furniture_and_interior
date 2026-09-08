import { useCallback, useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * Paying the people who make the furniture.
 *
 * Salaries could only be recorded as an expense — a lump sum with a description
 * and nothing behind it. No record of who was paid, what was withheld, or what
 * the business still owed afterwards.
 *
 * That last part is the point. Money deducted from someone's wages is not the
 * business's money: tax withheld belongs to FIRS and pension contributions
 * belong to the fund, and until they are remitted they are debts sitting in the
 * bank account looking exactly like money that can be spent.
 */

const naira = (value) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const month = (value) => (value ? String(value).slice(0, 7) : '—');

const RUN_STATUS = { draft: 'neutral', approved: 'warning', paid: 'success' };

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash_on_delivery', label: 'Cash' },
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

const Payroll = () => {
  const [tab, setTab] = useState('runs');
  const [isLoading, setIsLoading] = useState(true);

  const [runs, setRuns] = useState([]);
  const [staff, setStaff] = useState(null);
  const [open, setOpen] = useState(null);

  const [employeeForm, setEmployeeForm] = useState(null);
  const [paying, setPaying] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'runs') {
        const { data } = await axiosInstance.get('/payroll/runs');
        setRuns(data.payRuns);
      } else {
        const { data } = await axiosInstance.get('/payroll/employees');
        setStaff(data);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load payroll');
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (request, message) => {
    try {
      const { data } = await request();
      toast.success(data.message || message);
      load();
      if (open) {
        const { data: fresh } = await axiosInstance.get(`/payroll/runs/${open._id}`);
        setOpen(fresh.payRun);
      }
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || 'That did not work');
      return false;
    }
  };

  const buildRun = () => {
    const value = window.prompt(
      'Which month? Anyone employed for any part of it is included.',
      new Date().toISOString().slice(0, 7)
    );
    if (!value) return;

    act(() => axiosInstance.post('/payroll/runs', { month: `${value}-01` }), 'Draft built');
  };

  const openRun = async (run) => {
    try {
      const { data } = await axiosInstance.get(`/payroll/runs/${run._id}`);
      setOpen(data.payRun);
    } catch (error) {
      toast.error('Could not load that run');
    }
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      if (employeeForm._id) {
        await axiosInstance.patch(`/payroll/employees/${employeeForm._id}`, employeeForm);
      } else {
        await axiosInstance.post('/payroll/employees', employeeForm);
      }
      toast.success(employeeForm._id ? 'Updated' : 'On the payroll');
      setEmployeeForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save that');
    } finally {
      setIsSaving(false);
    }
  };

  const settle = async (event) => {
    event.preventDefault();
    const done = await act(
      () =>
        axiosInstance.post(`/payroll/runs/${paying._id}/pay`, {
          paymentMethod: paying.paymentMethod,
          paidOn: paying.paidOn,
        }),
      'Paid'
    );
    if (done) setPaying(null);
  };

  return (
    <AdminPageShell
      title="Payroll"
      subtitle="The people on the payroll, and what each month costs"
      actions={
        tab === 'runs' ? (
          <Button variant="primary" leftIcon={Plus} onClick={buildRun}>
            Build a month
          </Button>
        ) : (
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() =>
              setEmployeeForm({
                fullName: '',
                jobTitle: '',
                email: '',
                phone: '',
                employmentType: 'full_time',
                monthlySalary: '',
                payeRate: '',
                pensionRate: '',
                employerPensionRate: '',
                bankName: '',
                bankAccount: '',
                startedOn: new Date().toISOString().slice(0, 10),
              })
            }
          >
            Add someone
          </Button>
        )
      }
    >
      <div className="flex flex-wrap gap-1 border-b border-base-300">
        {[
          { id: 'runs', label: 'Pay runs' },
          { id: 'people', label: 'People' },
        ].map((item) => (
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
      ) : tab === 'runs' ? (
        <Panel title="Pay runs" description="One a month. Approving it is what makes the money owed.">
          {runs.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No pay runs yet"
              description="Build one for a month and it will pick up everyone employed in it."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">On the payroll</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">PAYE</th>
                    <th className="text-right">Pension</th>
                    <th className="text-right">Net paid</th>
                    <th className="text-right">Cost</th>
                    <th>Status</th>
                    <th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run._id} className="hover">
                      <td className="font-medium">{month(run.period)}</td>
                      <td className="text-right">{run.headcount}</td>
                      <td className="text-right font-mono tabular-nums">
                        {naira(run.totals.gross)}
                      </td>
                      <td className="text-right font-mono tabular-nums text-neutral/60">
                        {naira(run.totals.paye)}
                      </td>
                      <td className="text-right font-mono tabular-nums text-neutral/60">
                        {naira(run.totals.pension + run.totals.employerPension)}
                      </td>
                      <td className="text-right font-mono tabular-nums">{naira(run.totals.net)}</td>
                      {/* Gross plus the employer's own pension: what the month
                          actually costs, as against what the staff receive. */}
                      <td className="text-right font-mono tabular-nums font-semibold">
                        {naira(run.totals.cost)}
                      </td>
                      <td>
                        <Badge variant={RUN_STATUS[run.status]}>{run.status}</Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" onClick={() => openRun(run)}>
                            Payslips
                          </Button>
                          {run.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  window.confirm(
                                    `Approve ${month(run.period)}? This makes the wages, the tax and the pension owed.`
                                  ) &&
                                  act(
                                    () => axiosInstance.post(`/payroll/runs/${run._id}/approve`),
                                    'Approved'
                                  )
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  window.confirm('Discard this draft?') &&
                                  act(
                                    () => axiosInstance.delete(`/payroll/runs/${run._id}`),
                                    'Discarded'
                                  )
                                }
                              >
                                Discard
                              </Button>
                            </>
                          )}
                          {run.status === 'approved' && (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setPaying({
                                  ...run,
                                  paymentMethod: 'bank_transfer',
                                  paidOn: new Date().toISOString().slice(0, 10),
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
      ) : (
        staff && (
          <Panel
            title="People"
            description={`${staff.totals.headcount} on the payroll · ${naira(
              staff.totals.monthlyPayroll
            )} a month in gross wages`}
          >
            {staff.employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nobody on the payroll"
                description="Add the people the business pays."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th className="text-right">Salary</th>
                      <th className="text-right">PAYE</th>
                      <th className="text-right">Pension</th>
                      <th>Started</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {staff.employees.map((employee) => (
                      <tr
                        key={employee._id}
                        className={employee.isCurrent ? 'hover' : 'opacity-50'}
                      >
                        <td>
                          <span className="font-medium">{employee.fullName}</span>
                          {!employee.isCurrent && (
                            <Badge variant="neutral" className="ml-2">
                              left {employee.endedOn}
                            </Badge>
                          )}
                        </td>
                        <td className="text-sm text-neutral/60">{employee.jobTitle || '—'}</td>
                        <td className="text-right font-mono tabular-nums">
                          {naira(employee.monthlySalary)}
                        </td>
                        <td className="text-right text-sm text-neutral/60">
                          {employee.payeRate}%
                        </td>
                        <td className="text-right text-sm text-neutral/60">
                          {employee.pensionRate}% / {employee.employerPensionRate}%
                        </td>
                        <td className="whitespace-nowrap text-sm text-neutral/60">
                          {employee.startedOn}
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" onClick={() => setEmployeeForm({ ...employee })}>
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
        )
      )}

      {/* --- the payslips in a run ---------------------------------------- */}
      <Modal
        isOpen={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? `Payslips for ${month(open.period)}` : ''}
        className="max-w-4xl"
      >
        {open && (
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">PAYE</th>
                  <th className="text-right">Pension</th>
                  <th className="text-right">Net</th>
                  <th>Paid to</th>
                </tr>
              </thead>
              <tbody>
                {open.payslips.map((slip) => (
                  <tr key={slip._id}>
                    <td>
                      <span className="font-medium">{slip.employee.fullName}</span>
                      {slip.employee.jobTitle && (
                        <span className="block text-xs text-neutral/40">
                          {slip.employee.jobTitle}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono tabular-nums">{naira(slip.gross)}</td>
                    <td className="text-right font-mono tabular-nums text-neutral/60">
                      {naira(slip.paye)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-neutral/60">
                      {naira(slip.pension)}
                    </td>
                    <td className="text-right font-mono tabular-nums font-semibold">
                      {naira(slip.net)}
                    </td>
                    <td className="text-sm text-neutral/60">
                      {slip.employee.bankAccount
                        ? `${slip.employee.bankName ?? ''} ${slip.employee.bankAccount}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-sm text-neutral/50">
              The tax and the pension stay owed after the wages are paid — they are remitted
              separately, to different people. Until then they sit in {naira(open.totals.paye)} and{' '}
              {naira(open.totals.pension + open.totals.employerPension)} of liabilities.
            </p>
          </div>
        )}
      </Modal>

      {/* --- pay a run ---------------------------------------------------- */}
      <Modal
        isOpen={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={paying ? `Pay ${month(paying.period)}` : ''}
        className="max-w-lg"
      >
        {paying && (
          <form onSubmit={settle} className="space-y-4">
            <p className="text-sm text-neutral/60">
              {naira(paying.totals.net)} to {paying.headcount} people. Only the net — the
              {' '}{naira(paying.totals.paye)} of PAYE and{' '}
              {naira(paying.totals.pension + paying.totals.employerPension)} of pension stay owed
              until they are remitted.
            </p>

            <Select
              label="Paid by"
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
              <Button variant="primary" type="submit">
                Mark paid
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- someone on the payroll --------------------------------------- */}
      <Modal
        isOpen={Boolean(employeeForm)}
        onClose={() => setEmployeeForm(null)}
        title={employeeForm?._id ? `Edit ${employeeForm.fullName}` : 'Add someone'}
        className="max-w-2xl"
      >
        {employeeForm && (
          <form onSubmit={saveEmployee} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                required
                value={employeeForm.fullName ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
              />
              <Input
                label="Role"
                value={employeeForm.jobTitle ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Monthly salary (₦)"
                type="number"
                min="0"
                step="0.01"
                required
                value={employeeForm.monthlySalary ?? ''}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, monthlySalary: e.target.value })
                }
              />
              <Select
                label="Employment"
                value={employeeForm.employmentType ?? 'full_time'}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, employmentType: e.target.value })
                }
              >
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
              </Select>
            </div>

            {/* Rates rather than amounts: they are policy, and the amounts
                follow from the salary every month without being retyped. */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="PAYE %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={employeeForm.payeRate ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, payeRate: e.target.value })}
              />
              <Input
                label="Pension % (them)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={employeeForm.pensionRate ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, pensionRate: e.target.value })}
              />
              <Input
                label="Pension % (business)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                hint="A cost on top of the wage"
                value={employeeForm.employerPensionRate ?? ''}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, employerPensionRate: e.target.value })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Bank"
                value={employeeForm.bankName ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, bankName: e.target.value })}
              />
              <Input
                label="Account number"
                value={employeeForm.bankAccount ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, bankAccount: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Started"
                type="date"
                required
                value={employeeForm.startedOn ?? ''}
                onChange={(e) => setEmployeeForm({ ...employeeForm, startedOn: e.target.value })}
              />
              {employeeForm._id && (
                <Input
                  label="Left"
                  type="date"
                  hint="Leave empty while they are still here"
                  value={employeeForm.endedOn ?? ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, endedOn: e.target.value })}
                />
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEmployeeForm(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Payroll;
