import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { toMajor } from '../lib/money.js';

/**
 * Sales reporting, against PostgreSQL.
 *
 * Every figure here was a Mongo aggregation pipeline over the orders
 * collection: `$unwind` the items, `$lookup` the products, `$group`, `$sort`.
 * They are joins, so they are written as joins.
 *
 * One rule runs through all of it, and it is the same rule the old pipelines
 * used: a sale counts when it is paid and not cancelled or refunded. It is
 * stated once here rather than repeated as a `$match` in seven places, where it
 * had already drifted — the conversion funnel counted every order regardless of
 * status, which is correct for a funnel and wrong everywhere else, and nothing
 * said so.
 *
 * Amounts are kobo in the database and naira on the wire, as everywhere else.
 *
 * This is not the ledger. `services/ledger.js` answers what the business is
 * worth; this answers what it sold, which is a different question with a
 * different audience — and the two now reconcile, because the sale that appears
 * here is the same event that posted the journal entry.
 */

/** A sale, for reporting purposes. */
const SOLD = `o.payment_status = 'paid' AND o.status NOT IN ('cancelled', 'refunded')`;

const WINDOW = `o.created_at >= :start AND o.created_at <= :end`;

const select = (db, sql, replacements = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT });

const money = (value) => toMajor(Number(value ?? 0));

const endOfToday = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
};

export const parseDateRange = (startDate, endDate) => {
  // An unspecified end means "up to today", not "up to this instant". Ending
  // the window at the API process's own clock drops a row the database wrote a
  // moment ago under a clock a second ahead — which is how an order placed
  // seconds before the dashboard loaded went missing from it.
  const end = endDate ? new Date(endDate) : endOfToday();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return { start, end };
};

/**
 * What sold, by product category.
 *
 * A collection has no category, so its lines group under null — which is what
 * the Mongo `$lookup` against the products collection produced too, since it
 * only ever matched products.
 */
export const salesByCategory = async (range, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT p.category,
            SUM(oi.line_total)::bigint AS total_revenue,
            COUNT(DISTINCT o.id)::int  AS order_count,
            SUM(oi.quantity)::int      AS item_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.sellable_item_id
      WHERE ${WINDOW} AND ${SOLD}
      GROUP BY p.category
      ORDER BY total_revenue DESC`,
    { start: range.start, end: range.end }
  );

  return rows.map((row) => ({
    _id: row.category,
    totalRevenue: money(row.total_revenue),
    orderCount: row.order_count,
    itemCount: row.item_count,
  }));
};

/** Where it sold, from the address on the order. */
export const salesByRegion = async (range, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT o.shipping_address->>'state' AS state,
            o.shipping_address->>'city'  AS city,
            SUM(o.total_amount)::bigint  AS total_revenue,
            COUNT(*)::int                AS order_count
       FROM orders o
      WHERE ${WINDOW} AND ${SOLD}
      GROUP BY 1, 2
      ORDER BY total_revenue DESC
      LIMIT 50`,
    { start: range.start, end: range.end }
  );

  return rows.map((row) => ({
    _id: { state: row.state, city: row.city },
    totalRevenue: money(row.total_revenue),
    orderCount: row.order_count,
  }));
};

/**
 * What sold best.
 *
 * Grouped by the item id, with the name taken from the order line rather than
 * the catalog — the line is a snapshot, so a product renamed since the sale
 * still reports under the name it was sold as.
 */
export const productPerformance = async (range, { limit = 20 } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT oi.sellable_item_id,
            MIN(oi.name)               AS product_name,
            SUM(oi.line_total)::bigint AS total_revenue,
            SUM(oi.quantity)::int      AS units_sold,
            COUNT(DISTINCT o.id)::int  AS order_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE ${WINDOW} AND ${SOLD}
      GROUP BY oi.sellable_item_id
      ORDER BY total_revenue DESC
      LIMIT :limit`,
    { start: range.start, end: range.end, limit }
  );

  return rows.map((row) => ({
    _id: row.sellable_item_id,
    productName: row.product_name,
    totalRevenue: money(row.total_revenue),
    unitsSold: row.units_sold,
    orderCount: row.order_count,
  }));
};

/**
 * What each customer has been worth.
 *
 * Guest orders are excluded, as they were before: there is no customer to
 * attribute a lifetime to. The name comes from the account rather than being
 * concatenated from `firstName` and `lastName`, which the user document never
 * had — every row the old pipeline produced said "undefined undefined".
 */
export const customerLifetimeValue = async ({ limit = 50 } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT o.customer_id,
            c.full_name, c.email,
            SUM(o.total_amount)::bigint      AS total_spent,
            COUNT(*)::int                    AS order_count,
            AVG(o.total_amount)::bigint      AS average_order_value,
            MIN(o.created_at)                AS first_order,
            MAX(o.created_at)                AS last_order
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.customer_id IS NOT NULL AND ${SOLD}
      GROUP BY o.customer_id, c.full_name, c.email
      ORDER BY total_spent DESC
      LIMIT :limit`,
    { limit }
  );

  return rows.map((row) => ({
    _id: row.customer_id,
    userId: row.customer_id,
    userName: row.full_name,
    email: row.email,
    totalSpent: money(row.total_spent),
    orderCount: row.order_count,
    averageOrderValue: money(row.average_order_value),
    firstOrder: row.first_order,
    lastOrder: row.last_order,
  }));
};

/**
 * Registration through to payment.
 *
 * Counts every order at the first stage, paid or not — that is the point of a
 * funnel, and the only place in this file where `SOLD` deliberately does not
 * apply.
 */
export const conversionFunnel = async (range, db = getSequelize()) => {
  const [row] = await select(
    db,
    `SELECT
       (SELECT count(*) FROM customers WHERE created_at >= :start AND created_at <= :end)::int
         AS total_customers,
       (SELECT count(*) FROM orders o WHERE ${WINDOW})::int AS orders_started,
       (SELECT count(*) FROM orders o WHERE ${WINDOW}
          AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered'))::int
         AS orders_confirmed,
       (SELECT count(*) FROM orders o WHERE ${WINDOW} AND o.payment_status = 'paid')::int
         AS orders_paid`,
    { start: range.start, end: range.end }
  );

  const percent = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

  return {
    funnel: [
      { stage: 'Registered Users', count: row.total_customers },
      { stage: 'Orders Created', count: row.orders_started },
      { stage: 'Orders Confirmed', count: row.orders_confirmed },
      { stage: 'Orders Paid', count: row.orders_paid },
    ],
    conversionRates: {
      registrationToOrder: percent(row.orders_started, row.total_customers),
      orderToConfirmed: percent(row.orders_confirmed, row.orders_started),
      confirmedToPaid: percent(row.orders_paid, row.orders_confirmed),
      overallConversion: percent(row.orders_paid, row.total_customers),
    },
  };
};

/** The dashboard's five numbers. Consultations are still in Mongo and counted by the caller. */
export const overviewStats = async (range, db = getSequelize()) => {
  const [row] = await select(
    db,
    `SELECT
       COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOLD}), 0)::bigint AS total_revenue,
       COALESCE(AVG(o.total_amount) FILTER (WHERE ${SOLD}), 0)::bigint AS average_order_value,
       COUNT(*)::int AS total_orders
       FROM orders o
      WHERE ${WINDOW}`,
    { start: range.start, end: range.end }
  );

  const [customers] = await select(
    db,
    `SELECT count(*)::int AS total FROM customers
      WHERE created_at >= :start AND created_at <= :end`,
    { start: range.start, end: range.end }
  );

  return {
    totalRevenue: money(row.total_revenue),
    totalOrders: row.total_orders,
    totalCustomers: customers.total,
    averageOrderValue: money(row.average_order_value),
  };
};

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

/**
 * Which orders a revenue report counts.
 *
 * The two switches the console offers: include orders that have not been paid
 * for, and include the cancelled and refunded ones. Both default to off, which
 * is the figure an accountant means by "revenue".
 */
const revenueFilter = ({ includeUnpaid, includeRefunded }) => {
  const clauses = [WINDOW];
  if (!includeUnpaid) clauses.push(`o.payment_status = 'paid'`);
  if (!includeRefunded) clauses.push(`o.status NOT IN ('cancelled', 'refunded')`);
  return clauses.join(' AND ');
};

const revenueColumns = `
  COUNT(*)::int                       AS order_count,
  COALESCE(SUM(o.subtotal), 0)::bigint      AS subtotal,
  COALESCE(SUM(o.discount), 0)::bigint      AS discount,
  COALESCE(SUM(o.tax_amount), 0)::bigint    AS tax_amount,
  COALESCE(SUM(o.shipping_cost), 0)::bigint AS shipping_cost,
  COALESCE(SUM(o.total_amount), 0)::bigint  AS total_amount
`;

const asRevenue = (row) => ({
  orderCount: row.order_count,
  subtotal: money(row.subtotal),
  discount: money(row.discount),
  taxAmount: money(row.tax_amount),
  shippingCost: money(row.shipping_cost),
  totalAmount: money(row.total_amount),
});

export const revenueSummary = async (range, options = {}, db = getSequelize()) => {
  const filter = revenueFilter(options);
  const replacements = { start: range.start, end: range.end };

  const [totals] = await select(
    db,
    `SELECT ${revenueColumns} FROM orders o WHERE ${filter}`,
    replacements
  );

  const daily = await select(
    db,
    `SELECT to_char(o.created_at, 'YYYY-MM-DD') AS day, ${revenueColumns}
       FROM orders o WHERE ${filter}
      GROUP BY day ORDER BY day`,
    replacements
  );

  return {
    summary: asRevenue(totals),
    daily: daily.map((row) => ({ _id: row.day, ...asRevenue(row) })),
  };
};
