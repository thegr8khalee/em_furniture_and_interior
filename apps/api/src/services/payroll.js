import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor, percentOf } from '../lib/money.js';
import { postPayRun, postPayRunPaid } from './posting.js';

/**
 * Paying the people who make the furniture.
 *
 * `5500 Salaries and wages` could only be reached by recording an expense — a
 * lump sum with a description and nothing behind it. No record of who was paid,
 * what was withheld, or what the business still owed afterwards.
 *
 * That last part is the reason this exists rather than being left as an
 * expense. Money deducted from someone's wages is not the business's money. Tax
 * withheld belongs to FIRS and pension contributions belong to the fund, and
 * until they are remitted they are debts — sitting in the bank account looking
 * exactly like money the business can spend.
 */

export class PayrollError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PayrollError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/** The first day of the month a date falls in. */
const monthOf = (date) => {
  const value = new Date(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const publicEmployee = (row) => ({
  _id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  jobTitle: row.job_title,
  employmentType: row.employment_type,
  monthlySalary: money(row.monthly_salary),
  payeRate: Number(row.paye_rate),
  pensionRate: Number(row.pension_rate),
  employerPensionRate: Number(row.employer_pension_rate),
  bankName: row.bank_name,
  bankAccount: row.bank_account,
  staffId: row.staff_id,
  startedOn: row.started_on,
  endedOn: row.ended_on,
  isCurrent: !row.ended_on,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const EMPLOYEE_COLUMNS = `id, full_name, email, phone, job_title, employment_type,
  monthly_salary, paye_rate, pension_rate, employer_pension_rate,
  bank_name, bank_account, staff_id, started_on, ended_on, created_at, updated_at`;

export const listEmployees = async ({ currentOnly = false } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT ${EMPLOYEE_COLUMNS} FROM employees
      ${currentOnly ? 'WHERE ended_on IS NULL' : ''}
      ORDER BY ended_on NULLS FIRST, full_name`
  );

  const employees = rows.map(publicEmployee);
  const current = employees.filter((employee) => employee.isCurrent);

  return {
    employees,
    totals: {
      headcount: current.length,
      monthlyPayroll: current.reduce((total, e) => total + Number(e.monthlySalary), 0),
    },
  };
};

const rate = (value, label) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new PayrollError(`${label} has to be a percentage between 0 and 100.`);
  }
  return number;
};

export const addEmployee = async (input, db = getSequelize()) => {
  const { fullName, monthlySalary, startedOn } = input ?? {};

  if (!fullName || !String(fullName).trim()) throw new PayrollError('An employee needs a name.');
  if (!startedOn) throw new PayrollError('When did they start?');

  const salary = toMinor(Number(monthlySalary));
  if (!Number.isFinite(salary) || salary < 0) {
    throw new PayrollError('A salary cannot be negative.');
  }

  const row = await selectOne(
    db,
    `INSERT INTO employees
       (full_name, email, phone, job_title, employment_type, monthly_salary,
        paye_rate, pension_rate, employer_pension_rate, bank_name, bank_account,
        staff_id, started_on)
     VALUES (:fullName, :email, :phone, :jobTitle, :employmentType::employment_type, :salary,
             :paye, :pension, :employerPension, :bankName, :bankAccount,
             :staffId, :startedOn::date)
     RETURNING ${EMPLOYEE_COLUMNS}`,
    {
      fullName: String(fullName).trim(),
      email: input.email || null,
      phone: input.phone || null,
      jobTitle: input.jobTitle || null,
      employmentType: input.employmentType || 'full_time',
      salary,
      paye: rate(input.payeRate, 'The PAYE rate'),
      pension: rate(input.pensionRate, 'The pension rate'),
      employerPension: rate(input.employerPensionRate, "The employer's pension rate"),
      bankName: input.bankName || null,
      bankAccount: input.bankAccount || null,
      staffId: isValidId(String(input.staffId ?? '')) ? input.staffId : null,
      startedOn,
    }
  ).catch((error) => {
    if (error?.original?.code === '22P02') {
      throw new PayrollError(`"${input.employmentType}" is not a kind of employment.`);
    }
    throw error;
  });

  return publicEmployee(row);
};

export const updateEmployee = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PayrollError('Employee not found.', 404);

  const salary =
    input.monthlySalary === undefined ? null : toMinor(Number(input.monthlySalary));

  if (salary !== null && (!Number.isFinite(salary) || salary < 0)) {
    throw new PayrollError('A salary cannot be negative.');
  }

  const row = await selectOne(
    db,
    `UPDATE employees SET
       full_name = COALESCE(:fullName, full_name),
       email = CASE WHEN :emailGiven THEN :email ELSE email END,
       phone = CASE WHEN :phoneGiven THEN :phone ELSE phone END,
       job_title = CASE WHEN :titleGiven THEN :jobTitle ELSE job_title END,
       monthly_salary = COALESCE(:salary, monthly_salary),
       paye_rate = COALESCE(:paye, paye_rate),
       pension_rate = COALESCE(:pension, pension_rate),
       employer_pension_rate = COALESCE(:employerPension, employer_pension_rate),
       bank_name = CASE WHEN :bankGiven THEN :bankName ELSE bank_name END,
       bank_account = CASE WHEN :accountGiven THEN :bankAccount ELSE bank_account END,
       ended_on = CASE WHEN :endGiven THEN :endedOn::date ELSE ended_on END
     WHERE id = :id
     RETURNING ${EMPLOYEE_COLUMNS}`,
    {
      id,
      fullName: input.fullName ?? null,
      emailGiven: input.email !== undefined,
      email: input.email ?? null,
      phoneGiven: input.phone !== undefined,
      phone: input.phone ?? null,
      titleGiven: input.jobTitle !== undefined,
      jobTitle: input.jobTitle ?? null,
      salary,
      paye: input.payeRate === undefined ? null : rate(input.payeRate, 'The PAYE rate'),
      pension: input.pensionRate === undefined ? null : rate(input.pensionRate, 'The pension rate'),
      employerPension:
        input.employerPensionRate === undefined
          ? null
          : rate(input.employerPensionRate, "The employer's pension rate"),
      bankGiven: input.bankName !== undefined,
      bankName: input.bankName ?? null,
      accountGiven: input.bankAccount !== undefined,
      bankAccount: input.bankAccount ?? null,
      endGiven: input.endedOn !== undefined,
      endedOn: input.endedOn ?? null,
    }
  ).catch((error) => {
    if (error?.original?.constraint === 'employee_end_follows_start') {
      throw new PayrollError('They cannot have left before they started.');
    }
    throw error;
  });

  if (!row) throw new PayrollError('Employee not found.', 404);
  return publicEmployee(row);
};

// ---------------------------------------------------------------------------
// Pay runs
// ---------------------------------------------------------------------------

const publicPayRun = (row) => ({
  _id: row.id,
  period: row.period,
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  paidOn: row.paid_on,
  paymentMethod: row.payment_method,
  notes: row.notes,
  totals: {
    gross: money(row.gross),
    paye: money(row.paye),
    pension: money(row.pension),
    employerPension: money(row.employer_pension),
    otherDeductions: money(row.other_deductions),
    net: money(row.net),
    // What the run costs the business: gross plus the employer's own pension
    // contribution, which is a cost on top of the wage rather than out of it.
    cost: money(Number(row.gross ?? 0) + Number(row.employer_pension ?? 0)),
  },
  headcount: Number(row.headcount ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const RUN_SELECT = `
  SELECT r.id, r.period, r.status, r.approved_by, r.approved_at, r.paid_on,
         r.payment_method, r.notes, r.created_at, r.updated_at,
         COALESCE(s.gross, 0)::bigint AS gross,
         COALESCE(s.paye, 0)::bigint AS paye,
         COALESCE(s.pension, 0)::bigint AS pension,
         COALESCE(s.employer_pension, 0)::bigint AS employer_pension,
         COALESCE(s.other_deductions, 0)::bigint AS other_deductions,
         COALESCE(s.net, 0)::bigint AS net,
         COALESCE(s.headcount, 0)::int AS headcount
    FROM pay_runs r
    LEFT JOIN LATERAL (
      SELECT SUM(p.gross) AS gross, SUM(p.paye) AS paye, SUM(p.pension) AS pension,
             SUM(p.employer_pension) AS employer_pension,
             SUM(p.other_deductions) AS other_deductions, SUM(p.net) AS net,
             count(*)::int AS headcount
        FROM payslips p WHERE p.pay_run_id = r.id
    ) s ON true
`;

export const listPayRuns = async (db = getSequelize()) => {
  const rows = await select(db, `${RUN_SELECT} ORDER BY r.period DESC`);
  return rows.map(publicPayRun);
};

export const getPayRun = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PayrollError('Pay run not found.', 404);

  const row = await selectOne(db, `${RUN_SELECT} WHERE r.id = :id`, { id });
  if (!row) throw new PayrollError('Pay run not found.', 404);

  const payslips = await select(
    db,
    `SELECT p.id, p.gross, p.paye, p.pension, p.employer_pension, p.other_deductions,
            p.net, p.note, e.id AS employee_id, e.full_name, e.job_title,
            e.bank_name, e.bank_account
       FROM payslips p
       JOIN employees e ON e.id = p.employee_id
      WHERE p.pay_run_id = :id
      ORDER BY e.full_name`,
    { id }
  );

  return {
    ...publicPayRun(row),
    payslips: payslips.map((slip) => ({
      _id: slip.id,
      employee: {
        _id: slip.employee_id,
        fullName: slip.full_name,
        jobTitle: slip.job_title,
        bankName: slip.bank_name,
        bankAccount: slip.bank_account,
      },
      gross: money(slip.gross),
      paye: money(slip.paye),
      pension: money(slip.pension),
      employerPension: money(slip.employer_pension),
      otherDeductions: money(slip.other_deductions),
      net: money(slip.net),
      note: slip.note,
    })),
  };
};

/**
 * Builds a month's payroll from whoever was employed in it.
 *
 * The figures are copied onto each payslip rather than read through a join, so
 * a rise next month cannot rewrite what somebody was paid last month. A payslip
 * has to keep saying what it said.
 *
 * Draft, because approving it is what makes the money owed — the same shape as
 * an expense.
 */
export const createPayRun = async ({ month = null } = {}, db = getSequelize()) => {
  const period = monthOf(month ?? new Date());

  const id = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const existing = await selectOne(
      db,
      'SELECT id, status FROM pay_runs WHERE period = :period::date',
      { period },
      opts
    );
    if (existing) {
      throw new PayrollError(`${period.slice(0, 7)} already has a pay run.`);
    }

    // Anyone employed for any part of the month. Someone who left mid-month is
    // still owed for the part they worked, and leaving them out is how a final
    // salary goes unpaid.
    const employees = await select(
      db,
      `SELECT ${EMPLOYEE_COLUMNS} FROM employees
        WHERE started_on <= (:period::date + interval '1 month - 1 day')
          AND (ended_on IS NULL OR ended_on >= :period::date)
        ORDER BY full_name`,
      { period },
      opts
    );

    if (employees.length === 0) {
      throw new PayrollError('Nobody was employed in that month.');
    }

    const run = await selectOne(
      db,
      `INSERT INTO pay_runs (period) VALUES (:period::date) RETURNING id`,
      { period },
      opts
    );

    for (const employee of employees) {
      const gross = Number(employee.monthly_salary);
      const paye = percentOf(gross, Number(employee.paye_rate));
      const pension = percentOf(gross, Number(employee.pension_rate));
      const employerPension = percentOf(gross, Number(employee.employer_pension_rate));

      await db.query(
        `INSERT INTO payslips
           (pay_run_id, employee_id, gross, paye, pension, employer_pension, net)
         VALUES (:runId, :employeeId, :gross, :paye, :pension, :employerPension, :net)`,
        {
          replacements: {
            runId: run.id,
            employeeId: employee.id,
            gross,
            paye,
            pension,
            employerPension,
            net: gross - paye - pension,
          },
          ...opts,
        }
      );
    }

    return run.id;
  });

  return getPayRun(id, db);
};

/**
 * Approves a run, which is the moment the wages become owed.
 *
 * Three debts at once, which is the reason payroll is not just an expense:
 * what is owed to the staff, what is owed to FIRS, and what is owed to the
 * pension fund. The last two are money that was never the business's.
 */
export const approvePayRun = async (id, staffId, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PayrollError('Pay run not found.', 404);

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status FROM pay_runs WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new PayrollError('Pay run not found.', 404);
    if (before.status !== 'draft') {
      throw new PayrollError(`This run is already ${before.status}.`);
    }

    await db.query(
      `UPDATE pay_runs SET status = 'approved', approved_by = :staffId, approved_at = now()
        WHERE id = :id`,
      { replacements: { id, staffId: isValidId(String(staffId ?? '')) ? staffId : null }, ...opts }
    );

    await postPayRun(db, id, opts);
  });

  return getPayRun(id, db);
};

/**
 * Pays the net wages.
 *
 * Only the net: the tax and the pension stay owed until they are remitted,
 * which is a separate payment to a different party and is recorded as one.
 */
export const payPayRun = async (id, { paymentMethod, paidOn = null }, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PayrollError('Pay run not found.', 404);
  if (!paymentMethod) throw new PayrollError('How were they paid?');

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status FROM pay_runs WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new PayrollError('Pay run not found.', 404);
    if (before.status === 'paid') throw new PayrollError('This run is already paid.');
    if (before.status !== 'approved') {
      throw new PayrollError('Only an approved run can be paid.');
    }

    await db.query(
      `UPDATE pay_runs
          SET status = 'paid', paid_on = COALESCE(:paidOn::date, CURRENT_DATE),
              payment_method = :method::payment_method
        WHERE id = :id`,
      { replacements: { id, paidOn: paidOn || null, method: paymentMethod }, ...opts }
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new PayrollError(`"${paymentMethod}" is not a payment method.`);
      }
      throw error;
    });

    await postPayRunPaid(db, id, opts);
  });

  return getPayRun(id, db);
};

/**
 * Discards a draft.
 *
 * Only a draft. An approved run is in the books, and the way back is a
 * reversing entry — the same rule every other posted document follows.
 */
export const discardPayRun = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PayrollError('Pay run not found.', 404);

  const [, result] = await db.query(
    `DELETE FROM pay_runs WHERE id = :id AND status = 'draft'`,
    { replacements: { id } }
  );

  if ((result?.rowCount ?? 0) === 0) {
    const existing = await selectOne(db, 'SELECT status FROM pay_runs WHERE id = :id', { id });
    if (!existing) throw new PayrollError('Pay run not found.', 404);
    throw new PayrollError(
      `A run that is ${existing.status} is in the books. Reverse its journal entry instead.`
    );
  }

  return { discarded: true };
};
