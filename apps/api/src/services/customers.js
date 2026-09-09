import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor } from '../lib/money.js';

/**
 * Who has bought from the business, and what they bought.
 *
 * The `customers` table has had rows since the first migration and nothing ever
 * listed them. `findCustomerById` could fetch exactly one, by id, for the
 * shopper's own profile screen — so an operator could not answer "who signed up
 * this week", "has this person ordered before", or "what is this address I am
 * about to deliver to". The data was all there; nothing joined it up.
 *
 * This is the read side of that. It writes nothing except a deliberate loyalty
 * adjustment, because a customer record is edited by the customer.
 */

export class CustomerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CustomerError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

/**
 * What an order has to be to count as money the business has earned.
 *
 * The same rule the revenue reports use: paid, and not refunded. A basket that
 * was never paid for is not a purchase, and counting it would make every
 * "lifetime value" figure a fiction.
 */
const SPENT = `o.payment_status = 'paid' AND o.status <> 'refunded'`;

/** What `publicCustomer` needs, for the writes that return a row. */
const COLUMNS = `id, full_name, email, phone_number, loyalty_points, created_at, updated_at,
                 (password_hash IS NOT NULL) AS has_password`;

const publicCustomer = (row) => ({
  _id: row.id,
  id: row.id,
  // `username` is what both frontends read; the column is `full_name`.
  username: row.full_name,
  email: row.email,
  phoneNumber: row.phone_number,
  loyaltyPoints: row.loyalty_points,
  // Present only on the list and the detail, never on the shopper's own view.
  orderCount: row.order_count === undefined ? undefined : Number(row.order_count),
  totalSpent: row.total_spent === undefined ? undefined : money(row.total_spent),
  lastOrderAt: row.last_order_at,
  // How they sign in. An account with no password is a Supabase identity.
  signsInWith: row.has_password ? 'password' : 'supabase',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SORTS = {
  recent: 'c.created_at DESC',
  name: 'c.full_name ASC',
  spent: 'total_spent DESC NULLS LAST',
  orders: 'order_count DESC',
  last_order: 'last_order_at DESC NULLS LAST',
};

/**
 * Everyone who has an account, with what they are worth.
 *
 * The totals are computed in one lateral rather than per row in the caller: a
 * hundred customers meant a hundred round trips the obvious way, and the figure
 * an operator scans the list for is exactly this one.
 */
export const listCustomers = async (
  { page = 1, limit = 25, search = null, sort = 'recent', withOrdersOnly = false } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (search) {
    where.push('(c.full_name ILIKE :search OR c.email ILIKE :search OR c.phone_number ILIKE :search)');
    replacements.search = `%${search}%`;
  }
  if (withOrdersOnly) where.push('spend.order_count > 0');

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = SORTS[sort] ?? SORTS.recent;

  const rows = await select(
    db,
    `SELECT c.id, c.full_name, c.email, c.phone_number, c.loyalty_points,
            c.created_at, c.updated_at,
            (c.password_hash IS NOT NULL) AS has_password,
            COALESCE(spend.order_count, 0) AS order_count,
            COALESCE(spend.total_spent, 0)::bigint AS total_spent,
            spend.last_order_at
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS order_count,
                SUM(o.total_amount) FILTER (WHERE ${SPENT}) AS total_spent,
                max(o.created_at) AS last_order_at
           FROM orders o WHERE o.customer_id = c.id
       ) spend ON true
       ${filter}
      ORDER BY ${order}
      LIMIT :limit OFFSET :offset`,
    replacements
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS order_count FROM orders o WHERE o.customer_id = c.id
       ) spend ON true
       ${filter}`,
    replacements
  );

  return { customers: rows.map(publicCustomer), total: counted.total };
};

/** The headline figures, for the top of the screen. */
export const customerSummary = async (db = getSequelize()) => {
  const row = await selectOne(
    db,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new_this_month,
            count(*) FILTER (WHERE supabase_user_id IS NOT NULL)::int AS via_supabase
       FROM customers`
  );

  const spend = await selectOne(
    db,
    `SELECT count(DISTINCT o.customer_id)::int AS buyers,
            COALESCE(SUM(o.total_amount), 0)::bigint AS revenue
       FROM orders o
      WHERE o.customer_id IS NOT NULL AND ${SPENT}`
  );

  return {
    total: row.total,
    newThisMonth: row.new_this_month,
    viaSupabase: row.via_supabase,
    // Someone who has actually bought something, as against someone who signed up.
    buyers: spend.buyers,
    revenue: money(spend.revenue),
  };
};

/**
 * One customer, and everything the business knows about them.
 *
 * Orders, loyalty movements, reviews and consultations in one reply, because
 * every one of them is a thing an operator wants while they have the person on
 * the phone — and four requests to assemble one screen is four chances for it
 * to half-load.
 */
export const getCustomer = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new CustomerError('Customer not found.', 404);

  const customer = await selectOne(
    db,
    `SELECT c.id, c.full_name, c.email, c.phone_number, c.loyalty_points,
            c.created_at, c.updated_at,
            (c.password_hash IS NOT NULL) AS has_password,
            COALESCE(spend.order_count, 0) AS order_count,
            COALESCE(spend.total_spent, 0)::bigint AS total_spent,
            spend.last_order_at
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS order_count,
                SUM(o.total_amount) FILTER (WHERE ${SPENT}) AS total_spent,
                max(o.created_at) AS last_order_at
           FROM orders o WHERE o.customer_id = c.id
       ) spend ON true
      WHERE c.id = :id`,
    { id }
  );

  if (!customer) throw new CustomerError('Customer not found.', 404);

  const orders = await select(
    db,
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
            o.total_amount, o.created_at, o.delivered_at,
            o.shipping_address,
            COALESCE(items.list, '[]'::json) AS items
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity)
                         ORDER BY oi.name) AS list
           FROM order_items oi WHERE oi.order_id = o.id
       ) items ON true
      WHERE o.customer_id = :id
      ORDER BY o.created_at DESC
      LIMIT 100`,
    { id }
  );

  const loyalty = await select(
    db,
    `SELECT l.id, l.type, l.points, l.description, l.created_at, o.order_number
       FROM loyalty_transactions l
       LEFT JOIN orders o ON o.id = l.order_id
      WHERE l.customer_id = :id
      ORDER BY l.created_at DESC
      LIMIT 50`,
    { id }
  );

  const reviews = await select(
    db,
    `SELECT r.id, r.rating, r.comment, r.is_approved, r.created_at, s.name AS item_name
       FROM reviews r
       JOIN sellable_items s ON s.id = r.sellable_item_id
      WHERE r.customer_id = :id
      ORDER BY r.created_at DESC
      LIMIT 25`,
    { id }
  );

  const consultations = await select(
    db,
    `SELECT id, status, scheduled_at, budget_min, budget_max, created_at
       FROM consultation_requests
      WHERE customer_id = :id
      ORDER BY created_at DESC
      LIMIT 25`,
    { id }
  );

  return {
    customer: publicCustomer(customer),
    orders: orders.map((row) => ({
      _id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      totalAmount: money(row.total_amount),
      items: row.items ?? [],
      shippingAddress: row.shipping_address,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
    })),
    loyalty: loyalty.map((row) => ({
      _id: row.id,
      type: row.type,
      points: row.points,
      description: row.description,
      orderNumber: row.order_number,
      createdAt: row.created_at,
    })),
    reviews: reviews.map((row) => ({
      _id: row.id,
      rating: row.rating,
      comment: row.comment,
      isApproved: row.is_approved,
      item: row.item_name,
      createdAt: row.created_at,
    })),
    consultations: consultations.map((row) => ({
      _id: row.id,
      status: row.status,
      scheduledAt: row.scheduled_at,
      budget: { min: money(row.budget_min), max: money(row.budget_max) },
      createdAt: row.created_at,
    })),
  };
};

/**
 * The addresses this customer has had things delivered to.
 *
 * There is no address book: an address is captured on the order it was used
 * for, which is the honest record — people move, and an order has to keep the
 * address it actually went to. So this is derived, most recent first, with
 * duplicates collapsed.
 */
export const customerAddresses = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new CustomerError('Customer not found.', 404);

  const rows = await select(
    db,
    `SELECT DISTINCT ON (o.shipping_address->>'address', o.shipping_address->>'city')
            o.shipping_address AS address, o.created_at AS last_used
       FROM orders o
      WHERE o.customer_id = :id AND o.shipping_address IS NOT NULL
      ORDER BY o.shipping_address->>'address', o.shipping_address->>'city', o.created_at DESC`,
    { id }
  );

  return rows
    .map((row) => ({ ...row.address, lastUsed: row.last_used }))
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
};

/**
 * Adds a customer from the console.
 *
 * The shop was the only door: an account could be created by somebody signing
 * up on the website and no other way, so a walk-in who wanted an invoice could
 * not be recorded at all. Most of this business happens in a showroom.
 *
 * No password. `customers_has_credential` allows an account with neither a
 * password nor a Supabase identity to be refused, so one created here gets a
 * placeholder Supabase id — it can never be signed in to, which is right: the
 * shop should not be choosing passwords for its customers. If they want a
 * login they sign up themselves and the email match adopts this record, orders
 * and all.
 */
export const createCustomer = async (input, db = getSequelize()) => {
  const { fullName, email } = input ?? {};

  if (!fullName || !String(fullName).trim()) throw new CustomerError('A customer needs a name.');
  if (!email || !String(email).trim()) {
    throw new CustomerError('A customer needs an email — it is how their record is found again.');
  }

  const row = await selectOne(
    db,
    `INSERT INTO customers (full_name, email, phone_number, supabase_user_id)
     VALUES (:fullName, :email, :phone, gen_random_uuid())
     ON CONFLICT (email) DO NOTHING
     RETURNING ${COLUMNS}`,
    {
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      phone: input.phoneNumber || null,
    }
  );

  if (!row) {
    throw new CustomerError(
      `Somebody already has that email. Search for them rather than creating a second record.`
    );
  }

  return publicCustomer(row);
};

/**
 * Corrects a customer's details.
 *
 * A name spelled wrong on an invoice and a phone number that has changed are
 * the two reasons this exists. The email is editable too, because a typo in the
 * one field used to find the record again is the worst one to be stuck with.
 */
export const updateCustomer = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new CustomerError('Customer not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE customers SET
       full_name = COALESCE(:fullName, full_name),
       email = COALESCE(:email, email),
       phone_number = CASE WHEN :phoneGiven THEN :phone ELSE phone_number END
     WHERE id = :id
     RETURNING ${COLUMNS}`,
    {
      id,
      fullName: input.fullName ?? null,
      email: input.email ?? null,
      phoneGiven: input.phoneNumber !== undefined,
      phone: input.phoneNumber ?? null,
    }
  ).catch((error) => {
    if (error?.original?.constraint === 'customers_email_key') {
      throw new CustomerError('Somebody else already has that email.');
    }
    throw error;
  });

  if (!row) throw new CustomerError('Customer not found.', 404);
  return publicCustomer(row);
};

/**
 * Removes a customer.
 *
 * Only one who has never ordered. `orders.customer_id` is ON DELETE SET NULL,
 * so deleting somebody with a history would quietly strip their name off every
 * order they ever placed — the revenue would stay and the buyer would vanish,
 * which is worse than keeping a record nobody wants.
 */
export const deleteCustomer = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new CustomerError('Customer not found.', 404);

  const history = await selectOne(
    db,
    `SELECT count(*)::int AS orders FROM orders WHERE customer_id = :id`,
    { id }
  );

  if (history.orders > 0) {
    throw new CustomerError(
      `They have ${history.orders} order${history.orders === 1 ? '' : 's'}. ` +
        'Deleting them would take their name off every one of them.'
    );
  }

  const [, result] = await db.query('DELETE FROM customers WHERE id = :id', {
    replacements: { id },
  });

  if ((result?.rowCount ?? 0) === 0) throw new CustomerError('Customer not found.', 404);
  return { deleted: true };
};

/**
 * Adjusts a loyalty balance by hand, with a reason.
 *
 * Goodwill after a late delivery, or a correction. It writes the movement and
 * lets the balance follow, rather than setting the balance and leaving the
 * history unable to explain it — the mistake the Mongo version made, where
 * points were incremented in one place and recorded in another.
 */
export const adjustLoyalty = async (id, { points, reason }, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new CustomerError('Customer not found.', 404);

  const amount = Number(points);
  if (!Number.isInteger(amount) || amount === 0) {
    throw new CustomerError('An adjustment needs a whole number of points, up or down.');
  }
  if (!reason || !String(reason).trim()) {
    throw new CustomerError('An adjustment needs a reason. A balance nobody can explain is worse than a wrong one.');
  }

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, loyalty_points FROM customers WHERE id = :id FOR UPDATE',
      { id },
      opts
    );
    if (!before) throw new CustomerError('Customer not found.', 404);

    if (before.loyalty_points + amount < 0) {
      throw new CustomerError(
        `That would take the balance below zero — they have ${before.loyalty_points} points.`
      );
    }

    await db.query(
      `INSERT INTO loyalty_transactions (customer_id, type, points, description)
       VALUES (:id, 'adjustment', :points, :reason)`,
      { replacements: { id, points: amount, reason: String(reason).trim() }, ...opts }
    );

    const after = await selectOne(
      db,
      `UPDATE customers SET loyalty_points = loyalty_points + :points
        WHERE id = :id RETURNING loyalty_points`,
      { id, points: amount },
      opts
    );

    return { customerId: id, points: after.loyalty_points, adjustedBy: amount };
  });
};
