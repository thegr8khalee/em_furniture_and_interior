import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import {
  OrderError,
  getOrder,
  placeOrder,
  recordPayment,
  recordSaleMovements,
  setOrderStatus,
} from './orders.js';

/**
 * A sale that did not come through the website.
 *
 * Most of this business happens in a showroom or over WhatsApp, and the only
 * route that could create an order was the storefront's checkout — it needs a
 * cart, a guest cookie, and prices straight from the catalog. So the majority
 * of the shop's revenue had no way into the system at all.
 *
 * This is one call that does what a counter sale actually is: find or record
 * the buyer, price the lines at what was agreed, confirm it, and take the money
 * if it has been handed over.
 *
 * It goes through `placeOrder` rather than writing its own rows. An offline
 * sale must be indistinguishable from an online one once it is recorded — same
 * numbering, same postings, same reports — and a second path that writes orders
 * is a second path that drifts.
 */

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

/**
 * Who bought it.
 *
 * Three cases, because all three happen at a counter. A customer on record;
 * somebody new whose details are worth keeping; and a walk-in who wants a
 * receipt and nothing else — that last one gets a guest session, exactly as an
 * anonymous shopper on the website does, because `orders_has_a_buyer` requires
 * one or the other and inventing a customer record for every passer-by would
 * fill the book with people nobody can contact.
 */
const resolveBuyer = async (db, { customerId, customer }, opts) => {
  if (customerId) {
    if (!isValidId(String(customerId))) throw new OrderError('Customer not found.', 404);

    const found = await selectOne(
      db,
      'SELECT id, full_name, email, phone_number FROM customers WHERE id = :customerId',
      { customerId },
      opts
    );
    if (!found) throw new OrderError('Customer not found.', 404);

    return { owner: { customerId: found.id, guestSessionId: null }, person: found };
  }

  // Details given but no id: keep them, unless that email is already on record,
  // in which case this is somebody the shop already knows.
  if (customer?.email) {
    const existing = await selectOne(
      db,
      'SELECT id, full_name, email, phone_number FROM customers WHERE email = :email',
      { email: customer.email },
      opts
    );

    if (existing) {
      return { owner: { customerId: existing.id, guestSessionId: null }, person: existing };
    }

    const created = await selectOne(
      db,
      `INSERT INTO customers (full_name, email, phone_number, supabase_user_id)
       VALUES (:fullName, :email, :phone, gen_random_uuid())
       RETURNING id, full_name, email, phone_number`,
      {
        fullName: customer.fullName || customer.email,
        email: customer.email,
        phone: customer.phone || null,
      },
      opts
    );

    return { owner: { customerId: created.id, guestSessionId: null }, person: created };
  }

  const guest = await selectOne(
    db,
    `INSERT INTO guest_sessions (anonymous_id) VALUES (:anonymousId) RETURNING id`,
    { anonymousId: `counter-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    opts
  );

  return {
    owner: { customerId: null, guestSessionId: guest.id },
    person: {
      full_name: customer?.fullName || 'Walk-in customer',
      email: customer?.email || null,
      phone_number: customer?.phone || null,
    },
  };
};

/**
 * Records a sale made in person.
 *
 * Confirmed immediately, because it happened: the goods left the shop and the
 * revenue is earned. Payment is separate, because a counter sale is sometimes
 * paid on the spot and sometimes on account — and money taken before the order
 * is confirmed would be a deposit, which is not what a completed sale is.
 */
export const recordOfflineSale = async (input, staffId = null, db = getSequelize()) => {
  const {
    items,
    customerId = null,
    customer = null,
    paymentMethod = 'cash_on_delivery',
    shippingCost = 0,
    couponCode = null,
    notes = null,
    // What was actually handed over. Zero — or nothing — leaves it owing, which
    // is a real state: furniture is delivered before it is paid for all the time.
    amountPaid = null,
    deliveredNow = false,
  } = input ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderError('A sale needs at least one item.');
  }

  // The console's other line editors call this field `product`, and the
  // checkout calls it `item`. Rather than making the counter screen the odd one
  // out, both are accepted here and one shape goes on to the ordering service.
  const lines = items.map((line) => ({
    ...line,
    item: line?.item ?? line?.itemId ?? line?.product ?? line?.productId,
  }));

  const { owner, person } = await db.transaction((transaction) =>
    resolveBuyer(db, { customerId, customer }, { transaction })
  );

  // An address is required on every order. For a counter sale there may not be
  // one, so it records what is known — the name is the part that matters on a
  // receipt, and inventing a street would be worse than admitting there is none.
  const address = {
    fullName: person.full_name || 'Walk-in customer',
    phone: person.phone_number || input.customer?.phone || 'n/a',
    email: person.email || 'n/a',
    address: input.address?.address || 'Collected in person',
    city: input.address?.city || 'n/a',
    state: input.address?.state || 'n/a',
  };

  const { order } = await placeOrder(owner, {
    items: lines,
    shippingAddress: address,
    useSameAddressForBilling: true,
    couponCode,
    shippingCost,
    paymentMethod,
    notes: notes ? `Counter sale. ${notes}` : 'Counter sale',
    // The operator's agreed price, not the list price.
    allowPriceOverride: true,
  }, db);

  // Confirming is what recognises the revenue.
  await setOrderStatus(order._id, { status: 'confirmed', note: 'Sold in person' }, staffId, db);

  // And the goods are gone. Online, stock moves when the payment lands, because
  // nothing has been handed over until then. At a counter the sofa is on the
  // buyer's truck whether or not they have finished paying, so the movement
  // belongs here — otherwise the shop would go on offering furniture it no
  // longer owns to everyone on the website. The call is guarded by the
  // movements it would write, so the payment path below cannot take them out
  // a second time.
  await db.transaction((transaction) =>
    recordSaleMovements(db, order._id, staffId, { transaction })
  );

  let payment = null;
  const paid = amountPaid === null || amountPaid === undefined ? null : Number(amountPaid);

  if (paid === null || paid > 0) {
    // Nothing said means paid in full, which is what a counter sale usually is.
    const amount = paid === null ? Number(order.totalAmount) : paid;

    payment = await recordPayment(
      order._id,
      { amount, method: paymentMethod, staffId },
      db
    );
  }

  if (deliveredNow) {
    await setOrderStatus(order._id, { status: 'delivered', note: 'Taken away' }, staffId, db);
  }

  const finished = await getOrder(order._id, db).catch(() => null);

  return {
    order: finished ?? order,
    customer: owner.customerId
      ? { _id: owner.customerId, name: person.full_name, email: person.email }
      : null,
    payment,
    outstanding: payment ? payment.outstanding : Number(order.totalAmount),
  };
};
