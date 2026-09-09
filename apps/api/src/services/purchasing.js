import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';
import {
  postExpenseApproved,
  postExpensePaid,
  postPurchaseOrderPaid,
  postStockMovement,
} from './posting.js';

/**
 * What the business buys, and what it owes for it.
 *
 * Twelve of the thirty accounts in the chart could never receive a posting,
 * because nothing recorded a purchase: payables stayed empty, input VAT was
 * structurally zero, and rent, salaries and marketing had no way in. The profit
 * and loss showed revenue less cost of sales and stopped, which is a gross
 * margin, not a profit.
 *
 * Two documents. An **expense** is money spent — approved once, which makes it a
 * cost and a debt, and paid once, which settles the debt. A **purchase order**
 * is an intention to buy, which becomes stock and a liability when the goods
 * arrive.
 *
 * Both post through the same rules the sales side uses, so the two halves of the
 * business meet in one trial balance rather than in a spreadsheet.
 */

export class PurchasingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PurchasingError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/**
 * An empty form field is an absent value, not a value of "".
 *
 * A blank date input posts `""`, and `''::date` is not a null date — it is a
 * syntax error, so an optional "expected on" left empty turned creating a
 * purchase order into a 500. Every optional value that can arrive from a form
 * goes through this.
 */
const orNull = (value) => (value === '' || value === undefined ? null : value);

const amount = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new PurchasingError(`${label} must be a non-negative number.`);
  }
  return toMinor(number);
};

/** A document number from the gapless counter, so nobody has to ask about a hole. */
const nextNumber = async (db, counter, prefix, opts) => {
  const row = await selectOne(
    db,
    `SELECT to_char(now(), 'YYYY') || '-' ||
            lpad(next_number(:counter)::text, 5, '0') AS value`,
    { counter },
    opts
  );
  return `${prefix}-${row.value}`;
};

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

const VENDOR_COLUMNS = 'id, name, email, phone, address, notes, is_active, created_at, updated_at';

const publicVendor = (row) => ({
  _id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  address: row.address,
  notes: row.notes,
  isActive: row.is_active,
  outstanding: row.outstanding === undefined ? undefined : money(row.outstanding),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Suppliers, each with what is still owed to them. */
export const listVendors = async ({ activeOnly = false } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT v.id, v.name, v.email, v.phone, v.address, v.notes, v.is_active,
            v.created_at, v.updated_at,
            COALESCE(SUM(e.total_amount) FILTER (WHERE e.status = 'approved'), 0)::bigint
              AS outstanding
       FROM vendors v
       LEFT JOIN expenses e ON e.vendor_id = v.id
      ${activeOnly ? 'WHERE v.is_active' : ''}
      GROUP BY v.id
      ORDER BY v.name`
  );

  return rows.map(publicVendor);
};

export const createVendor = async (input, db = getSequelize()) => {
  const { name } = input || {};
  if (!name) throw new PurchasingError('A vendor needs a name.');

  const row = await selectOne(
    db,
    `INSERT INTO vendors (name, email, phone, address, notes)
     VALUES (:name, :email, :phone, :address, :notes)
     ON CONFLICT (name) DO NOTHING
     RETURNING ${VENDOR_COLUMNS}`,
    {
      name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    }
  );

  if (!row) throw new PurchasingError(`There is already a vendor called ${name}.`);
  return publicVendor(row);
};

export const updateVendor = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Vendor not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE vendors SET
       name = COALESCE(:name, name),
       email = CASE WHEN :emailGiven THEN :email ELSE email END,
       phone = CASE WHEN :phoneGiven THEN :phone ELSE phone END,
       address = CASE WHEN :addressGiven THEN :address ELSE address END,
       notes = CASE WHEN :notesGiven THEN :notes ELSE notes END,
       is_active = COALESCE(:isActive, is_active)
     WHERE id = :id RETURNING ${VENDOR_COLUMNS}`,
    {
      id,
      name: input.name ?? null,
      emailGiven: input.email !== undefined,
      email: input.email ?? null,
      phoneGiven: input.phone !== undefined,
      phone: input.phone ?? null,
      addressGiven: input.address !== undefined,
      address: input.address ?? null,
      notesGiven: input.notes !== undefined,
      notes: input.notes ?? null,
      isActive: typeof input.isActive === 'boolean' ? input.isActive : null,
    }
  ).catch((error) => {
    if (error?.original?.constraint === 'vendors_name_key') {
      throw new PurchasingError(`There is already a vendor called ${input.name}.`);
    }
    throw error;
  });

  if (!row) throw new PurchasingError('Vendor not found.', 404);
  return publicVendor(row);
};

/**
 * Retires a vendor.
 *
 * One with any history is deactivated rather than deleted — `expenses.vendor_id`
 * is ON DELETE RESTRICT, because a supplier cannot disappear from the record of
 * what was bought from them.
 */
export const removeVendor = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) return { removed: false };

  const used = await selectOne(
    db,
    `SELECT 1 AS found FROM expenses WHERE vendor_id = :id
      UNION SELECT 1 FROM purchase_orders WHERE vendor_id = :id LIMIT 1`,
    { id }
  );

  if (used) {
    const row = await selectOne(
      db,
      `UPDATE vendors SET is_active = false WHERE id = :id RETURNING ${VENDOR_COLUMNS}`,
      { id }
    );
    if (!row) return { removed: false };
    return { removed: true, deactivated: true, vendor: publicVendor(row) };
  }

  const [, result] = await db.query('DELETE FROM vendors WHERE id = :id', { replacements: { id } });
  return { removed: (result?.rowCount ?? 0) > 0, deactivated: false };
};

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const EXPENSE_SELECT = `
  SELECT e.id, e.expense_number, e.description, e.expense_date,
         e.net_amount, e.tax_amount, e.total_amount, e.status,
         e.payment_method, e.paid_on, e.receipt_url, e.notes,
         e.recorded_by, e.approved_by, e.approved_at, e.created_at, e.updated_at,
         a.code AS account_code, a.name AS account_name,
         v.id AS vendor_id, v.name AS vendor_name
    FROM expenses e
    JOIN accounts a ON a.id = e.account_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
`;

const publicExpense = (row) => ({
  _id: row.id,
  expenseNumber: row.expense_number,
  vendor: row.vendor_id ? { _id: row.vendor_id, name: row.vendor_name } : null,
  account: { code: row.account_code, name: row.account_name },
  description: row.description,
  date: row.expense_date,
  netAmount: money(row.net_amount),
  taxAmount: money(row.tax_amount),
  totalAmount: money(row.total_amount),
  status: row.status,
  paymentMethod: row.payment_method,
  paidOn: row.paid_on,
  receiptUrl: row.receipt_url,
  notes: row.notes,
  recordedBy: row.recorded_by,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const accountByCode = async (db, code, opts) => {
  const account = await selectOne(
    db,
    'SELECT id, code, is_postable FROM accounts WHERE code = :code',
    { code },
    opts
  );
  if (!account) throw new PurchasingError(`No account ${code}.`);
  if (!account.is_postable) {
    throw new PurchasingError(
      `${code} is a summary account, so nothing can be booked to it directly.`
    );
  }
  return account;
};

export const listExpenses = async (
  { page = 1, limit = 50, status = null, vendorId = null, from = null, to = null } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (status) {
    where.push('e.status = :status::expense_status');
    replacements.status = status;
  }
  if (vendorId && isValidId(String(vendorId))) {
    where.push('e.vendor_id = :vendorId');
    replacements.vendorId = vendorId;
  }
  if (from) {
    where.push('e.expense_date >= :from::date');
    replacements.from = from;
  }
  if (to) {
    where.push('e.expense_date <= :to::date');
    replacements.to = to;
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `${EXPENSE_SELECT} ${filter}
      ORDER BY e.expense_date DESC, e.expense_number DESC
      LIMIT :limit OFFSET :offset`,
    replacements
  );

  const totals = await selectOne(
    db,
    `SELECT count(*)::int AS total,
            COALESCE(SUM(e.total_amount), 0)::bigint AS value
       FROM expenses e ${filter}`,
    replacements
  );

  return {
    expenses: rows.map(publicExpense),
    total: totals.total,
    totalValue: money(totals.value),
  };
};

export const getExpense = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Expense not found.', 404);

  const row = await selectOne(db, `${EXPENSE_SELECT} WHERE e.id = :id`, { id });
  if (!row) throw new PurchasingError('Expense not found.', 404);
  return publicExpense(row);
};

/**
 * Records a cost.
 *
 * Created as a draft, because approval is a separate decision and the thing
 * approval does is create a liability. `total = net + tax` is a check
 * constraint, so a total typed by hand that does not add up is refused rather
 * than reconciled later.
 */
export const createExpense = async (input, recordedBy = null, db = getSequelize()) => {
  const { accountCode, description, date, netAmount, vendorId } = input || {};

  if (!accountCode) throw new PurchasingError('An expense needs an account to book it to.');
  if (!description) throw new PurchasingError('An expense needs a description.');
  if (!date) throw new PurchasingError('An expense needs a date.');
  if (netAmount === undefined) throw new PurchasingError('An expense needs an amount.');

  if (vendorId && !isValidId(String(vendorId))) {
    throw new PurchasingError('Vendor not found.');
  }

  const net = amount(netAmount, 'Amount');
  const tax = input.taxAmount === undefined ? 0 : amount(input.taxAmount, 'Tax');

  return db.transaction(async (transaction) => {
    const opts = { transaction };
    const account = await accountByCode(db, accountCode, opts);

    const row = await selectOne(
      db,
      `INSERT INTO expenses (expense_number, vendor_id, account_id, description, expense_date,
                             net_amount, tax_amount, total_amount, notes, receipt_url,
                             receipt_public_id, recorded_by)
       VALUES (:number, :vendorId, :accountId, :description, :date::date,
               :net, :tax, :total, :notes, :receiptUrl, :receiptPublicId, :recordedBy)
       RETURNING id`,
      {
        number: await nextNumber(db, 'expense', 'EXP', opts),
        vendorId: vendorId || null,
        accountId: account.id,
        description,
        date,
        net,
        tax,
        total: net + tax,
        notes: orNull(input.notes),
        receiptUrl: orNull(input.receiptUrl),
        receiptPublicId: orNull(input.receiptPublicId),
        recordedBy: isValidId(String(recordedBy ?? '')) ? recordedBy : null,
      },
      opts
    ).catch((error) => {
      if (error?.original?.constraint === 'expenses_vendor_id_fkey') {
        throw new PurchasingError('Vendor not found.');
      }
      throw error;
    });

    return row.id;
  }).then((id) => getExpense(id, db));
};

/**
 * Corrects a draft expense.
 *
 * Only a draft. Once an expense is approved it has been posted, and the way to
 * change something that is in the books is a journal entry that says so, not an
 * UPDATE that quietly makes the ledger disagree with the document it came from.
 * A wrong approved expense is voided and recorded again.
 *
 * Everything is optional, and an omitted field is left alone — an operator
 * fixing a typo in a description should not have to resend the amount and risk
 * changing it.
 */
export const updateExpense = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Expense not found.', 404);
  if (input.vendorId && !isValidId(String(input.vendorId))) {
    throw new PurchasingError('Vendor not found.');
  }

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      `SELECT id, status, net_amount, tax_amount, account_id
         FROM expenses WHERE id = :id FOR UPDATE`,
      { id },
      opts
    );

    if (!before) throw new PurchasingError('Expense not found.', 404);
    if (before.status !== 'draft') {
      throw new PurchasingError(
        `This expense is ${before.status}, so it is already in the books. ` +
          'Void it and record it again rather than editing it.'
      );
    }

    const accountId = input.accountCode
      ? (await accountByCode(db, input.accountCode, opts)).id
      : before.account_id;

    const net =
      input.netAmount === undefined ? Number(before.net_amount) : amount(input.netAmount, 'Amount');
    const tax =
      input.taxAmount === undefined ? Number(before.tax_amount) : amount(input.taxAmount, 'Tax');

    await db.query(
      `UPDATE expenses SET
         account_id   = :accountId,
         vendor_id    = CASE WHEN :vendorGiven THEN :vendorId ELSE vendor_id END,
         description  = COALESCE(:description, description),
         expense_date = COALESCE(:date::date, expense_date),
         net_amount   = :net,
         tax_amount   = :tax,
         total_amount = :total,
         notes        = CASE WHEN :notesGiven THEN :notes ELSE notes END,
         receipt_url  = CASE WHEN :receiptGiven THEN :receiptUrl ELSE receipt_url END
       WHERE id = :id`,
      {
        replacements: {
          id,
          accountId,
          vendorGiven: input.vendorId !== undefined,
          vendorId: input.vendorId || null,
          description: orNull(input.description),
          date: orNull(input.date),
          net,
          tax,
          total: net + tax,
          notesGiven: input.notes !== undefined,
          notes: orNull(input.notes),
          receiptGiven: input.receiptUrl !== undefined,
          receiptUrl: orNull(input.receiptUrl),
        },
        ...opts,
      }
    ).catch((error) => {
      if (error?.original?.constraint === 'expenses_vendor_id_fkey') {
        throw new PurchasingError('Vendor not found.');
      }
      throw error;
    });
  });

  return getExpense(id, db);
};

/**
 * Approves an expense, which is the moment it becomes a cost and a debt.
 *
 * The posting happens in the same transaction as the status change, so an
 * expense that says "approved" with nothing behind it in the books is not a
 * state that can exist.
 */
export const approveExpense = async (id, staffId, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Expense not found.', 404);

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status FROM expenses WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new PurchasingError('Expense not found.', 404);
    if (before.status === 'void') throw new PurchasingError('A void expense cannot be approved.');
    if (before.status !== 'draft') {
      throw new PurchasingError(`This expense is already ${before.status}.`);
    }

    await db.query(
      `UPDATE expenses SET status = 'approved', approved_by = :staffId, approved_at = now()
        WHERE id = :id`,
      { replacements: { id, staffId: isValidId(String(staffId ?? '')) ? staffId : null }, ...opts }
    );

    await postExpenseApproved(db, id, opts);
  });

  return getExpense(id, db);
};

/**
 * Pays an approved expense.
 *
 * Only an approved one: paying something nobody approved would put money out of
 * the bank against a debt the books never recognised.
 */
export const payExpense = async (id, { paymentMethod, paidOn }, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Expense not found.', 404);
  if (!paymentMethod) throw new PurchasingError('How was it paid?');

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status FROM expenses WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new PurchasingError('Expense not found.', 404);
    if (before.status === 'paid') throw new PurchasingError('This expense is already paid.');
    if (before.status !== 'approved') {
      throw new PurchasingError('Only an approved expense can be paid.');
    }

    await db.query(
      `UPDATE expenses SET status = 'paid', payment_method = :method::payment_method,
              paid_on = COALESCE(:paidOn::date, CURRENT_DATE)
        WHERE id = :id`,
      { replacements: { id, method: paymentMethod, paidOn: orNull(paidOn) }, ...opts }
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new PurchasingError(`"${paymentMethod}" is not a payment method.`);
      }
      throw error;
    });

    await postExpensePaid(db, id, opts);
  });

  return getExpense(id, db);
};

/**
 * Voids a draft.
 *
 * Only a draft. An approved expense is in the books, and the way to undo
 * something in the books is a reversing entry, not a status change — that is the
 * difference between a ledger and a spreadsheet.
 */
export const voidExpense = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Expense not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE expenses SET status = 'void' WHERE id = :id AND status = 'draft' RETURNING id`,
    { id }
  );

  if (!row) {
    const existing = await selectOne(db, 'SELECT status FROM expenses WHERE id = :id', { id });
    if (!existing) throw new PurchasingError('Expense not found.', 404);
    throw new PurchasingError(
      `An expense that is ${existing.status} is in the books. Reverse its journal entry instead.`
    );
  }

  return getExpense(id, db);
};

/**
 * What is owed to suppliers, oldest first.
 *
 * Two kinds of debt, one list. An **approved expense** is owed from the day it
 * was approved; a **received purchase order** is owed from the day the goods
 * arrived. Both credit `2100` in the ledger, so a report that showed only one of
 * them disagreed with the balance sheet — which is the failure this whole design
 * exists to prevent.
 */
export const payablesAgeing = async (db = getSequelize()) => {
  const rows = await select(
    db,
    `WITH owed AS (
       SELECT e.vendor_id, e.total_amount AS amount, e.expense_date AS owed_since
         FROM expenses e WHERE e.status = 'approved'
       UNION ALL
       SELECT po.vendor_id,
              COALESCE((SELECT SUM(i.line_total) FROM purchase_order_items i
                         WHERE i.purchase_order_id = po.id), 0),
              po.received_on
         FROM purchase_orders po
        WHERE po.status = 'received' AND po.paid_on IS NULL
     )
     SELECT v.id, v.name,
            COALESCE(SUM(o.amount), 0)::bigint AS total,
            COALESCE(SUM(o.amount) FILTER (
              WHERE o.owed_since > CURRENT_DATE - 30), 0)::bigint AS current,
            COALESCE(SUM(o.amount) FILTER (
              WHERE o.owed_since <= CURRENT_DATE - 30
                AND o.owed_since > CURRENT_DATE - 60), 0)::bigint AS thirty,
            COALESCE(SUM(o.amount) FILTER (
              WHERE o.owed_since <= CURRENT_DATE - 60), 0)::bigint AS sixty
       FROM owed o
       LEFT JOIN vendors v ON v.id = o.vendor_id
      GROUP BY v.id, v.name
     HAVING COALESCE(SUM(o.amount), 0) <> 0
      ORDER BY total DESC`
  );

  return rows.map((row) => ({
    vendor: row.id ? { _id: row.id, name: row.name } : null,
    total: money(row.total),
    current: money(row.current),
    thirtyDays: money(row.thirty),
    sixtyDaysPlus: money(row.sixty),
  }));
};

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

const PO_SELECT = `
  SELECT po.id, po.po_number, po.status, po.expected_on, po.received_on, po.notes,
         po.paid_on, po.payment_method,
         po.created_by, po.received_by, po.created_at, po.updated_at,
         v.id AS vendor_id, v.name AS vendor_name,
         COALESCE(items.list, '[]'::json) AS items,
         COALESCE(items.total, 0)::bigint AS total
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
               '_id', i.id, 'product', i.product_id, 'name', s.name,
               'quantity', i.quantity, 'unitCost', i.unit_cost, 'lineTotal', i.line_total
             ) ORDER BY s.name) AS list,
             SUM(i.line_total) AS total
        FROM purchase_order_items i
        JOIN sellable_items s ON s.id = i.product_id
       WHERE i.purchase_order_id = po.id
    ) items ON true
`;

const publicPurchaseOrder = (row) => ({
  _id: row.id,
  poNumber: row.po_number,
  vendor: { _id: row.vendor_id, name: row.vendor_name },
  status: row.status,
  expectedOn: row.expected_on,
  receivedOn: row.received_on,
  paidOn: row.paid_on,
  paymentMethod: row.payment_method,
  notes: row.notes,
  items: (row.items ?? []).map((item) => ({
    _id: item._id,
    product: item.product,
    name: item.name,
    quantity: item.quantity,
    unitCost: money(item.unitCost),
    lineTotal: money(item.lineTotal),
  })),
  total: money(row.total),
  createdBy: row.created_by,
  receivedBy: row.received_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listPurchaseOrders = async (
  { page = 1, limit = 50, status = null, vendorId = null } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (status) {
    where.push('po.status = :status::purchase_order_status');
    replacements.status = status;
  }
  if (vendorId && isValidId(String(vendorId))) {
    where.push('po.vendor_id = :vendorId');
    replacements.vendorId = vendorId;
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `${PO_SELECT} ${filter} ORDER BY po.created_at DESC LIMIT :limit OFFSET :offset`,
    replacements
  );
  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM purchase_orders po ${filter}`,
    replacements
  );

  return { purchaseOrders: rows.map(publicPurchaseOrder), total: counted.total };
};

export const getPurchaseOrder = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);

  const row = await selectOne(db, `${PO_SELECT} WHERE po.id = :id`, { id });
  if (!row) throw new PurchasingError('Purchase order not found.', 404);
  return publicPurchaseOrder(row);
};

export const createPurchaseOrder = async (input, createdBy = null, db = getSequelize()) => {
  const { vendorId, items } = input || {};

  if (!isValidId(String(vendorId ?? ''))) throw new PurchasingError('A purchase order needs a vendor.');
  if (!Array.isArray(items) || items.length === 0) {
    throw new PurchasingError('A purchase order needs at least one line.');
  }

  const id = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const row = await selectOne(
      db,
      `INSERT INTO purchase_orders (po_number, vendor_id, expected_on, notes, created_by)
       VALUES (:number, :vendorId, :expectedOn::date, :notes, :createdBy)
       RETURNING id`,
      {
        number: await nextNumber(db, 'purchase_order', 'PO', opts),
        vendorId,
        expectedOn: orNull(input.expectedOn),
        notes: orNull(input.notes),
        createdBy: isValidId(String(createdBy ?? '')) ? createdBy : null,
      },
      opts
    ).catch((error) => {
      if (error?.original?.constraint === 'purchase_orders_vendor_id_fkey') {
        throw new PurchasingError('Vendor not found.');
      }
      throw error;
    });

    for (const line of items) {
      const quantity = Number(line?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new PurchasingError('Each line needs a whole quantity of at least one.');
      }
      const unitCost = amount(line?.unitCost, 'Unit cost');

      await db.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity,
                                           unit_cost, line_total)
         VALUES (:orderId, :productId, :quantity, :unitCost, :lineTotal)`,
        {
          replacements: {
            orderId: row.id,
            productId: line.product ?? line.productId,
            quantity,
            unitCost,
            lineTotal: unitCost * quantity,
          },
          ...opts,
        }
      ).catch((error) => {
        const constraint = error?.original?.constraint;
        if (constraint === 'purchase_order_items_product_id_fkey' || error?.original?.code === '22P02') {
          throw new PurchasingError(`No product ${line.product ?? line.productId}.`);
        }
        if (constraint === 'purchase_order_items_purchase_order_id_product_id_key') {
          throw new PurchasingError('The same product appears on this order twice.');
        }
        throw error;
      });
    }

    return row.id;
  });

  return getPurchaseOrder(id, db);
};

/**
 * Changes a purchase order that has not gone out yet.
 *
 * Draft only, for the same reason as an expense: a sent order is a promise
 * somebody else is acting on, and a received one has already made stock and a
 * debt. Editing either would rewrite the document the ledger was posted from.
 *
 * When lines are given they replace the lines that were there. A purchase order
 * is short and an operator correcting one is looking at the whole thing — line
 * by line patching would need ids the console has no reason to carry, and
 * nothing has been posted yet, so there is nothing to preserve.
 */
export const updatePurchaseOrder = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);
  if (input.vendorId && !isValidId(String(input.vendorId))) {
    throw new PurchasingError('Vendor not found.');
  }
  if (input.items !== undefined && (!Array.isArray(input.items) || input.items.length === 0)) {
    throw new PurchasingError('A purchase order needs at least one line.');
  }

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status FROM purchase_orders WHERE id = :id FOR UPDATE',
      { id },
      opts
    );

    if (!before) throw new PurchasingError('Purchase order not found.', 404);
    if (before.status !== 'draft') {
      throw new PurchasingError(
        `This order has been ${before.status}, so it can no longer be edited.`
      );
    }

    await db.query(
      `UPDATE purchase_orders SET
         vendor_id   = COALESCE(:vendorId, vendor_id),
         expected_on = CASE WHEN :expectedGiven THEN :expectedOn::date ELSE expected_on END,
         notes       = CASE WHEN :notesGiven THEN :notes ELSE notes END
       WHERE id = :id`,
      {
        replacements: {
          id,
          vendorId: input.vendorId || null,
          expectedGiven: input.expectedOn !== undefined,
          expectedOn: orNull(input.expectedOn),
          notesGiven: input.notes !== undefined,
          notes: orNull(input.notes),
        },
        ...opts,
      }
    ).catch((error) => {
      if (error?.original?.constraint === 'purchase_orders_vendor_id_fkey') {
        throw new PurchasingError('Vendor not found.');
      }
      throw error;
    });

    if (input.items === undefined) return;

    await db.query('DELETE FROM purchase_order_items WHERE purchase_order_id = :id', {
      replacements: { id },
      ...opts,
    });

    for (const line of input.items) {
      const quantity = Number(line?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new PurchasingError('Each line needs a whole quantity of at least one.');
      }
      const unitCost = amount(line?.unitCost, 'Unit cost');

      await db.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity,
                                           unit_cost, line_total)
         VALUES (:orderId, :productId, :quantity, :unitCost, :lineTotal)`,
        {
          replacements: {
            orderId: id,
            productId: line.product ?? line.productId,
            quantity,
            unitCost,
            lineTotal: unitCost * quantity,
          },
          ...opts,
        }
      ).catch((error) => {
        const constraint = error?.original?.constraint;
        if (
          constraint === 'purchase_order_items_product_id_fkey' ||
          error?.original?.code === '22P02'
        ) {
          throw new PurchasingError(`No product ${line.product ?? line.productId}.`);
        }
        if (constraint === 'purchase_order_items_purchase_order_id_product_id_key') {
          throw new PurchasingError('The same product appears on this order twice.');
        }
        throw error;
      });
    }
  });

  return getPurchaseOrder(id, db);
};

export const sendPurchaseOrder = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE purchase_orders SET status = 'sent' WHERE id = :id AND status = 'draft' RETURNING id`,
    { id }
  );

  if (!row) {
    const existing = await selectOne(db, 'SELECT status FROM purchase_orders WHERE id = :id', { id });
    if (!existing) throw new PurchasingError('Purchase order not found.', 404);
    throw new PurchasingError(`This order is already ${existing.status}.`);
  }

  return getPurchaseOrder(id, db);
};

/**
 * Receives the goods.
 *
 * This is the moment a purchase order stops being a document and becomes stock
 * and a debt. Each line writes a `purchase_receipt` movement carrying the unit
 * cost that was agreed, and each movement posts — inventory up, payables up.
 *
 * The cost on the movement is the cost that was ordered, not the product's
 * current cost price, because what the business owes is what it agreed to pay.
 */
export const receivePurchaseOrder = async (
  id,
  { receivedOn = null, staffId = null } = {},
  db = getSequelize()
) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const order = await selectOne(
      db,
      'SELECT id, status FROM purchase_orders WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!order) throw new PurchasingError('Purchase order not found.', 404);
    if (order.status === 'received') throw new PurchasingError('This order is already received.');
    if (order.status === 'cancelled') {
      throw new PurchasingError('A cancelled order cannot be received.');
    }

    await db.query(
      `UPDATE purchase_orders
          SET status = 'received',
              received_on = COALESCE(:receivedOn::date, CURRENT_DATE),
              received_by = :staffId
        WHERE id = :id`,
      {
        replacements: {
          id,
          receivedOn: orNull(receivedOn),
          staffId: isValidId(String(staffId ?? '')) ? staffId : null,
        },
        ...opts,
      }
    );

    const movements = await select(
      db,
      `INSERT INTO stock_movements (product_id, quantity, reason, purchase_order_id,
                                    staff_id, unit_cost, occurred_at)
       SELECT i.product_id, i.quantity, 'purchase_receipt', i.purchase_order_id,
              :staffId, i.unit_cost,
              COALESCE(:receivedOn::date, CURRENT_DATE)
         FROM purchase_order_items i
        WHERE i.purchase_order_id = :id
       RETURNING id`,
      { id, staffId: isValidId(String(staffId ?? '')) ? staffId : null, receivedOn: orNull(receivedOn) },
      opts
    );

    for (const movement of movements) {
      await postStockMovement(db, movement.id, opts);
    }
  });

  return getPurchaseOrder(id, db);
};

/**
 * Pays for goods already received.
 *
 * Only a received order: paying for something that has not arrived is a deposit
 * or a mistake, and neither is this. Receipt is what creates the debt.
 */
export const payPurchaseOrder = async (
  id,
  { paymentMethod, paidOn = null } = {},
  db = getSequelize()
) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);
  if (!paymentMethod) throw new PurchasingError('How was it paid?');

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const order = await selectOne(
      db,
      'SELECT id, status, paid_on FROM purchase_orders WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!order) throw new PurchasingError('Purchase order not found.', 404);
    if (order.paid_on) throw new PurchasingError('This order is already paid.');
    if (order.status !== 'received') {
      throw new PurchasingError('Only a received order can be paid for.');
    }

    await db.query(
      `UPDATE purchase_orders
          SET paid_on = COALESCE(:paidOn::date, CURRENT_DATE),
              payment_method = :method::payment_method
        WHERE id = :id`,
      { replacements: { id, paidOn: orNull(paidOn), method: paymentMethod }, ...opts }
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new PurchasingError(`"${paymentMethod}" is not a payment method.`);
      }
      throw error;
    });

    await postPurchaseOrderPaid(db, id, opts);
  });

  return getPurchaseOrder(id, db);
};

export const cancelPurchaseOrder = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new PurchasingError('Purchase order not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE purchase_orders SET status = 'cancelled'
      WHERE id = :id AND status IN ('draft', 'sent') RETURNING id`,
    { id }
  );

  if (!row) {
    const existing = await selectOne(db, 'SELECT status FROM purchase_orders WHERE id = :id', { id });
    if (!existing) throw new PurchasingError('Purchase order not found.', 404);
    throw new PurchasingError(
      'An order whose goods have arrived cannot be cancelled. Return the stock instead.'
    );
  }

  return getPurchaseOrder(id, db);
};
