import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor, percentOf, sumMinor } from '../lib/money.js';
import { claim } from './coupons.js';
import { postOrderConfirmed } from './posting.js';
import { logger } from '../lib/logger.js';

/**
 * Orders, against PostgreSQL.
 *
 * The Mongo version computed the total from numbers the browser sent it. The
 * schema comment on `orders_total_is_the_sum_of_its_parts` is about exactly
 * that: shipping and tax came straight off the request body and were trusted,
 * so an invoice could be produced that nothing reconciled against. Here every
 * amount that can be derived is derived — line prices come from
 * `sellable_items`, the discount from the coupon row, tax from the configured
 * rate — and the database refuses the insert if the total does not add up.
 *
 * Money is kobo in the database and naira on the wire, as everywhere else.
 * `toMinor` on the way in, `toMajor` on the way out; nothing in between is a
 * float.
 *
 * Three things that were application code and are now the schema's:
 *
 *   - Status history. `order_status_events` is written by a trigger, so a bulk
 *     update is recorded too. The Mongoose version pushed onto an array in the
 *     handler and missed anything that did not go through it.
 *   - The line total. `line_total = unit_price * quantity` is a check
 *     constraint.
 *   - A double-submitted checkout. `orders.idempotency_key` is unique, so the
 *     second submission returns the first order instead of creating another.
 */

export class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'OrderError';
    this.status = status;
  }
}

/** VAT, from the environment. The tax endpoint reads the same value. */
const taxRate = () => {
  const configured = Number.parseFloat(process.env.TAX_RATE_PERCENTAGE);
  return Number.isFinite(configured) ? configured : 7.5;
};

const ITEM_TYPE = { product: 'Product', collection: 'Collection' };

const mapItem = (row) => ({
  _id: row.id,
  item: row.sellable_item_id,
  itemType: ITEM_TYPE[row.kind] ?? 'Product',
  name: row.name,
  imageUrl: row.image_url ?? undefined,
  price: toMajor(Number(row.unit_price)),
  quantity: row.quantity,
  subtotal: toMajor(Number(row.line_total)),
});

const mapStatusEvent = (row) => ({
  status: row.status,
  updatedBy: row.changed_by,
  note: row.note ?? '',
  timestamp: row.created_at,
});

/**
 * The published order.
 *
 * Field for field what the Mongo document published, because both frontends and
 * the PDF templates read it: `totalAmount` in naira, `items[].subtotal`,
 * `shippingAddress` as an object. `_id` is the UUID.
 */
const mapOrder = (row, { items = [], statusHistory = null } = {}) => {
  const order = {
    _id: row.id,
    orderNumber: row.order_number,
    user: row.customer_id,
    guest: row.guest_session_id,
    isGuestOrder: row.customer_id === null,
    items: items.map(mapItem),
    shippingAddress: row.shipping_address,
    billingAddress: row.billing_address,
    useSameAddressForBilling:
      JSON.stringify(row.billing_address) === JSON.stringify(row.shipping_address),
    subtotal: toMajor(Number(row.subtotal)),
    discount: toMajor(Number(row.discount)),
    couponCode: row.coupon_code,
    couponId: row.coupon_id,
    shippingCost: toMajor(Number(row.shipping_cost)),
    taxAmount: toMajor(Number(row.tax_amount)),
    totalAmount: toMajor(Number(row.total_amount)),
    currency: row.currency,
    loyaltyPointsEarned: row.loyalty_points_earned,
    loyaltyPointsCredited: row.loyalty_points_credited,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    carrier: row.carrier,
    estimatedDeliveryDate: row.estimated_delivery_date,
    deliveredAt: row.delivered_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (statusHistory) order.statusHistory = statusHistory.map(mapStatusEvent);
  if (row.admin_notes !== undefined) order.adminNotes = row.admin_notes;

  return order;
};

const ORDER_COLUMNS = `
  o.id, o.order_number, o.customer_id, o.guest_session_id, o.shipping_address,
  o.billing_address, o.subtotal, o.discount, o.coupon_id, o.coupon_code,
  o.shipping_cost, o.tax_amount, o.total_amount, o.currency, o.status,
  o.payment_status, o.payment_method, o.tracking_number, o.tracking_url,
  o.carrier, o.estimated_delivery_date, o.delivered_at, o.notes,
  o.loyalty_points_earned, o.loyalty_points_credited, o.created_at, o.updated_at
`;

const select = async (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const loadItems = (db, orderIds, opts = {}) =>
  select(
    db,
    `SELECT oi.id, oi.order_id, oi.sellable_item_id, oi.name, oi.image_url,
            oi.unit_price, oi.quantity, oi.line_total, s.kind
       FROM order_items oi
       LEFT JOIN sellable_items s ON s.id = oi.sellable_item_id
      WHERE oi.order_id IN (:orderIds)
      ORDER BY oi.name`,
    { orderIds },
    opts
  );

/** Attaches each order's lines with one query for the whole page. */
const withItems = async (db, rows, opts = {}) => {
  if (rows.length === 0) return [];

  const items = await loadItems(db, rows.map((row) => row.id), opts);
  const byOrder = new Map();
  for (const item of items) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
    byOrder.get(item.order_id).push(item);
  }

  return rows.map((row) => mapOrder(row, { items: byOrder.get(row.id) ?? [] }));
};

// ---------------------------------------------------------------------------
// Placing an order
// ---------------------------------------------------------------------------

/**
 * Prices the requested lines from the catalog.
 *
 * The request says what and how many; it does not say for how much. A promoted
 * item is charged at its promotional price, and `unit_cost` is captured
 * alongside so margin is answerable later without a join onto a price that has
 * since changed.
 */
const priceLines = async (db, items, opts) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderError('Order must contain at least one item');
  }

  const lines = [];

  for (const requested of items) {
    const id = requested?.item ?? requested?.itemId;
    const quantity = Number(requested?.quantity ?? 1);

    if (!isValidId(String(id ?? ''))) {
      throw new OrderError(`Invalid item id: ${id}`, 400);
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new OrderError('Quantity must be a whole number of at least one');
    }

    const item = await selectOne(
      db,
      `SELECT s.id, s.kind, s.name, s.price, s.discounted_price, s.is_promo, s.cost_price,
              (SELECT url FROM sellable_images WHERE sellable_item_id = s.id
                ORDER BY position LIMIT 1) AS image_url
         FROM sellable_items s WHERE s.id = :id`,
      { id },
      opts
    );

    if (!item) {
      throw new OrderError(`${ITEM_TYPE[requested?.itemType?.toLowerCase()] ?? 'Item'} ${id} not found`, 404);
    }

    const unitPrice = Number(
      item.is_promo && item.discounted_price !== null ? item.discounted_price : item.price
    );

    lines.push({
      sellableItemId: item.id,
      kind: item.kind,
      name: item.name,
      imageUrl: item.image_url,
      unitPrice,
      unitCost: item.cost_price === null ? null : Number(item.cost_price),
      quantity,
      lineTotal: unitPrice * quantity,
    });
  }

  return lines;
};

/**
 * Claims one use of a coupon.
 *
 * The claim, and the arithmetic behind the discount, are in services/coupons.js
 * — the same code the storefront's "check this code" endpoint quotes from, so
 * the figure shown and the figure charged cannot disagree.
 *
 * A code that does not apply is not an error. The previous behaviour was to
 * ignore it and charge full price, and refusing a whole checkout over a mistyped
 * promotion would be worse for the shopper than losing the discount.
 */
const claimCoupon = async (db, code, subtotalMinor, opts) => {
  if (!code) return { discount: 0, couponId: null, couponCode: null };

  const claimed = await claim(code, subtotalMinor, db, opts);

  if (!claimed) {
    logger.info(
      { code: String(code).toUpperCase() },
      'Coupon not applied — inactive, expired, spent or below the minimum'
    );
    return { discount: 0, couponId: null, couponCode: null };
  }

  return {
    discount: claimed.discount,
    couponId: claimed.coupon.id,
    couponCode: claimed.coupon.code,
  };
};

const requireAddress = (address, label) => {
  if (!address || typeof address !== 'object') {
    throw new OrderError(`${label} is required`);
  }

  for (const field of ['fullName', 'phone', 'email', 'address', 'city', 'state']) {
    if (!address[field]) {
      throw new OrderError(`${label} is missing ${field}`);
    }
  }

  return { country: 'Nigeria', ...address };
};

/**
 * Places an order.
 *
 * Everything happens in one transaction: the order, its lines, the coupon it
 * spent. A half-written order — lines without a header, or a coupon marked used
 * against an order that was never created — is not a state anyone can reason
 * about afterwards.
 */
export const placeOrder = async (owner, input, db = getSequelize()) => {
  const {
    items,
    shippingAddress,
    billingAddress,
    useSameAddressForBilling,
    couponCode,
    shippingCost = 0,
    notes,
    paymentMethod = 'whatsapp',
    idempotencyKey = null,
  } = input || {};

  const shipping = requireAddress(shippingAddress, 'Shipping address');
  const billing = useSameAddressForBilling
    ? shipping
    : billingAddress
      ? requireAddress(billingAddress, 'Billing address')
      : shipping;

  const shippingMinor = toMinor(Number(shippingCost) || 0);
  if (shippingMinor < 0) throw new OrderError('Shipping cost cannot be negative');

  // An idempotency key that names an existing order returns that order. The
  // checkout button is a double-click away from two orders otherwise.
  if (idempotencyKey) {
    const existing = await selectOne(
      db,
      `SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.idempotency_key = :key`,
      { key: idempotencyKey }
    );
    if (existing) {
      const [order] = await withItems(db, [existing]);
      return { order, duplicate: true };
    }
  }

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const lines = await priceLines(db, items, opts);
    const subtotal = sumMinor(lines.map((line) => line.lineTotal));

    const { discount, couponId, couponCode: appliedCode } = await claimCoupon(
      db,
      couponCode,
      subtotal,
      opts
    );

    // Tax is computed here, not accepted from the caller. It is the one figure
    // a customer has a direct incentive to send as zero.
    const taxAmount = percentOf(subtotal - discount + shippingMinor, taxRate());
    const totalAmount = subtotal - discount + shippingMinor + taxAmount;

    const number = await selectOne(
      db,
      `SELECT to_char(now(), 'YYYY') || '-' ||
              lpad(next_number('order')::text, 5, '0') AS value`,
      {},
      opts
    );

    const row = await selectOne(
      db,
      `INSERT INTO orders (
         order_number, customer_id, guest_session_id, shipping_address, billing_address,
         subtotal, discount, coupon_id, coupon_code, shipping_cost, tax_amount,
         total_amount, payment_method, notes, idempotency_key
       ) VALUES (
         :orderNumber, :customerId, :guestSessionId, :shippingAddress, :billingAddress,
         :subtotal, :discount, :couponId, :couponCode, :shippingCost, :taxAmount,
         :totalAmount, :paymentMethod, :notes, :idempotencyKey
       ) RETURNING ${ORDER_COLUMNS.replaceAll('o.', '')}`,
      {
        orderNumber: `ORD-${number.value}`,
        customerId: owner.customerId,
        guestSessionId: owner.guestSessionId,
        shippingAddress: JSON.stringify(shipping),
        billingAddress: JSON.stringify(billing),
        subtotal,
        discount,
        couponId,
        couponCode: appliedCode,
        shippingCost: shippingMinor,
        taxAmount,
        totalAmount,
        paymentMethod,
        notes: notes || null,
        idempotencyKey,
      },
      opts
    ).catch((error) => {
      if (`${error?.original?.constraint}` === 'orders_payment_method_check') {
        throw new OrderError(`"${paymentMethod}" is not a payment method`);
      }
      if (error?.original?.code === '22P02') {
        throw new OrderError(`"${paymentMethod}" is not a payment method`);
      }
      throw error;
    });

    for (const line of lines) {
      await db.query(
        `INSERT INTO order_items
           (order_id, sellable_item_id, name, image_url, unit_price, unit_cost, quantity, line_total)
         VALUES (:orderId, :itemId, :name, :imageUrl, :unitPrice, :unitCost, :quantity, :lineTotal)`,
        {
          replacements: {
            orderId: row.id,
            itemId: line.sellableItemId,
            name: line.name,
            imageUrl: line.imageUrl,
            unitPrice: line.unitPrice,
            unitCost: line.unitCost,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          },
          ...opts,
        }
      );
    }

    const items_ = await loadItems(db, [row.id], opts);
    return { order: mapOrder(row, { items: items_ }), duplicate: false };
  });
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const ownerWhere = (owner) =>
  owner.customerId ? 'o.customer_id = :customerId' : 'o.guest_session_id = :guestSessionId';

export const listOrdersForOwner = async (owner, { page = 1, limit = 10 } = {}, db = getSequelize()) => {
  const offset = (page - 1) * limit;

  const rows = await select(
    db,
    `SELECT ${ORDER_COLUMNS} FROM orders o
      WHERE ${ownerWhere(owner)}
      ORDER BY o.created_at DESC LIMIT :limit OFFSET :offset`,
    { ...owner, limit, offset }
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM orders o WHERE ${ownerWhere(owner)}`,
    owner
  );

  return { orders: await withItems(db, rows), total: counted.total };
};

/** The order, if it belongs to this shopper. Not found and not theirs are separate answers. */
export const getOrderForOwner = async (owner, orderId, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) throw new OrderError('Order not found', 404);

  const row = await selectOne(db, `SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.id = :orderId`, {
    orderId,
  });

  if (!row) throw new OrderError('Order not found', 404);

  const isTheirs = owner.customerId
    ? row.customer_id === owner.customerId
    : row.guest_session_id === owner.guestSessionId;

  if (!isTheirs) throw new OrderError('Not authorized to view this order', 403);

  const [order] = await withItems(db, [row]);
  return order;
};

/**
 * Tracking, for someone who is not signed in.
 *
 * The order number alone is not enough — they are sequential, so anyone could
 * read the next customer's order. The email on the order has to match, and the
 * comparison is case-insensitive because nobody types their address back the
 * same way twice.
 */
export const trackOrder = async (orderNumber, email, db = getSequelize()) => {
  if (!email) throw new OrderError('Email is required for order tracking');

  const row = await selectOne(
    db,
    `SELECT ${ORDER_COLUMNS} FROM orders o
      WHERE o.order_number = :orderNumber
        AND lower(o.shipping_address->>'email') = lower(:email)`,
    { orderNumber, email }
  );

  if (!row) throw new OrderError('Order not found or email does not match', 404);

  const [order] = await withItems(db, [row]);
  return order;
};

/** The console's list: filters, search and a page of results. */
export const listOrders = async (
  { page = 1, limit = 20, status = null, paymentStatus = null, search = null } = {},
  db = getSequelize()
) => {
  const where = [];
  const replacements = { limit, offset: (page - 1) * limit };

  if (status) {
    where.push('o.status = :status::order_status');
    replacements.status = status;
  }
  if (paymentStatus) {
    where.push('o.payment_status = :paymentStatus::payment_status');
    replacements.paymentStatus = paymentStatus;
  }
  if (search) {
    where.push(`(
      o.order_number ILIKE :search
      OR o.shipping_address->>'fullName' ILIKE :search
      OR o.shipping_address->>'email' ILIKE :search
    )`);
    replacements.search = `%${search}%`;
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await select(
    db,
    `SELECT ${ORDER_COLUMNS}, o.admin_notes FROM orders o ${filter}
      ORDER BY o.created_at DESC LIMIT :limit OFFSET :offset`,
    replacements
  );

  const counted = await selectOne(
    db,
    `SELECT count(*)::int AS total FROM orders o ${filter}`,
    replacements
  );

  return { orders: await withItems(db, rows), total: counted.total };
};

/** One order with its full history, for the console. */
export const getOrder = async (orderId, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) throw new OrderError('Order not found', 404);

  const row = await selectOne(
    db,
    `SELECT ${ORDER_COLUMNS}, o.admin_notes FROM orders o WHERE o.id = :orderId`,
    { orderId }
  );
  if (!row) throw new OrderError('Order not found', 404);

  const [items, history] = await Promise.all([
    loadItems(db, [row.id]),
    select(
      db,
      `SELECT status, changed_by, note, created_at FROM order_status_events
        WHERE order_id = :orderId ORDER BY created_at`,
      { orderId }
    ),
  ]);

  return mapOrder(row, { items, statusHistory: history });
};

// ---------------------------------------------------------------------------
// Changing an order
// ---------------------------------------------------------------------------

const LOYALTY_POINTS_PER_NAIRA = 1 / 1000;

/**
 * Moves an order to a new status, and does whatever that status means.
 *
 * Confirmation is the point revenue is recognised, so the journal entry is
 * posted here, inside the same transaction as the status change: an order that
 * says "confirmed" with no entry behind it is a hole in the books that nobody
 * finds until a reconciliation fails months later.
 *
 * The status history row is not written here. `orders_record_status` writes it,
 * so it happens for a bulk update too — which is the failure the Mongoose
 * version had, where history only existed if the change went through this
 * handler.
 */
export const setOrderStatus = async (orderId, changes, staffId = null, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) throw new OrderError('Order not found', 404);

  const { status, note, trackingNumber, trackingUrl, carrier, estimatedDeliveryDate } = changes || {};

  const result = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, status, customer_id, total_amount, loyalty_points_credited FROM orders WHERE id = :orderId FOR UPDATE',
      { orderId },
      opts
    );
    if (!before) throw new OrderError('Order not found', 404);

    const row = await selectOne(
      db,
      `UPDATE orders SET
         status = COALESCE(:status::order_status, status),
         tracking_number = COALESCE(:trackingNumber, tracking_number),
         tracking_url = COALESCE(:trackingUrl, tracking_url),
         carrier = COALESCE(:carrier, carrier),
         estimated_delivery_date = COALESCE(:estimatedDeliveryDate::date, estimated_delivery_date),
         -- The schema requires a delivered order to say when. Setting it here
         -- rather than asking the caller keeps that from being a 500.
         delivered_at = CASE
           WHEN :status::order_status = 'delivered' AND delivered_at IS NULL THEN now()
           ELSE delivered_at
         END
       WHERE id = :orderId
       RETURNING ${ORDER_COLUMNS.replaceAll('o.', '')}, admin_notes`,
      {
        orderId,
        status: status ?? null,
        trackingNumber: trackingNumber ?? null,
        trackingUrl: trackingUrl ?? null,
        carrier: carrier ?? null,
        estimatedDeliveryDate: estimatedDeliveryDate ?? null,
      },
      opts
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new OrderError(`"${status}" is not an order status`);
      }
      throw error;
    });

    // The trigger recorded the status; this attributes it and carries the note.
    if (note || (status && status !== before.status)) {
      await db.query(
        `UPDATE order_status_events SET changed_by = :staffId, note = :note
          WHERE id = (SELECT id FROM order_status_events WHERE order_id = :orderId
                       ORDER BY created_at DESC, id DESC LIMIT 1)`,
        { replacements: { orderId, staffId, note: note || null }, ...opts }
      );
    }

    let loyaltyPoints = 0;

    if (status === 'confirmed' && before.status !== 'confirmed') {
      await postOrderConfirmed(db, orderId, opts);
    }

    if (status === 'delivered' && row.customer_id && !before.loyalty_points_credited) {
      loyaltyPoints = Math.floor(toMajor(Number(row.total_amount)) * LOYALTY_POINTS_PER_NAIRA);

      if (loyaltyPoints > 0) {
        await db.query(
          'UPDATE customers SET loyalty_points = loyalty_points + :points WHERE id = :customerId',
          { replacements: { points: loyaltyPoints, customerId: row.customer_id }, ...opts }
        );
        await db.query(
          `UPDATE orders SET loyalty_points_earned = :points, loyalty_points_credited = true
            WHERE id = :orderId`,
          { replacements: { points: loyaltyPoints, orderId }, ...opts }
        );
        row.loyalty_points_earned = loyaltyPoints;
        row.loyalty_points_credited = true;
      }
    }

    const items = await loadItems(db, [orderId], opts);
    return { order: mapOrder(row, { items }), loyaltyPoints, previousStatus: before.status };
  });

  return result;
};

/**
 * Records that an order has been paid, or has not been.
 *
 * Paying takes the goods out of stock. `stock_movements` is the inventory
 * ledger, so this writes a negative `sale` movement per product line and the
 * balance follows from it — there is no counter to decrement and get wrong.
 * Collections are not stocked items and are skipped.
 */
export const setPaymentStatus = async (orderId, paymentStatus, staffId = null, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) throw new OrderError('Order not found', 404);
  if (!paymentStatus) throw new OrderError('A payment status is required');

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const before = await selectOne(
      db,
      'SELECT id, payment_status, customer_id FROM orders WHERE id = :orderId FOR UPDATE',
      { orderId },
      opts
    );
    if (!before) throw new OrderError('Order not found', 404);

    const row = await selectOne(
      db,
      `UPDATE orders SET payment_status = :paymentStatus::payment_status
        WHERE id = :orderId RETURNING ${ORDER_COLUMNS.replaceAll('o.', '')}, admin_notes`,
      { orderId, paymentStatus },
      opts
    ).catch((error) => {
      if (error?.original?.code === '22P02') {
        throw new OrderError(`"${paymentStatus}" is not a payment status`);
      }
      throw error;
    });

    if (paymentStatus === 'paid' && before.payment_status !== 'paid') {
      await recordSaleMovements(db, orderId, staffId, opts);
    }

    const items = await loadItems(db, [orderId], opts);
    return {
      order: mapOrder(row, { items }),
      customerId: row.customer_id,
      nowPaid: paymentStatus === 'paid' && before.payment_status !== 'paid',
    };
  });
};

/**
 * Takes the goods on an order out of stock, once.
 *
 * Guarded by what is already in the ledger rather than by a flag on the order:
 * if a `sale` movement exists for this order, the goods have already left, and
 * a second call — a retried request, a status flipped back and forth — must not
 * take them out twice.
 */
const recordSaleMovements = async (db, orderId, staffId, opts) => {
  const already = await selectOne(
    db,
    `SELECT 1 AS found FROM stock_movements WHERE order_id = :orderId AND reason = 'sale' LIMIT 1`,
    { orderId },
    opts
  );
  if (already) return;

  await db.query(
    `INSERT INTO stock_movements (product_id, quantity, reason, order_id, staff_id, unit_cost)
     SELECT p.id, -oi.quantity, 'sale', oi.order_id, :staffId, oi.unit_cost
       FROM order_items oi
       JOIN products p ON p.id = oi.sellable_item_id
      WHERE oi.order_id = :orderId`,
    { replacements: { orderId, staffId }, ...opts }
  );
};

/**
 * What a successful payment does to the order it paid for.
 *
 * Called from inside the payment's own transaction, so a charge that is
 * recorded and an order that is not is impossible. Three things happen
 * together: the order is marked paid, a pending order becomes confirmed — which
 * is the moment revenue is recognised, so the sale is posted — and the goods
 * leave stock.
 *
 * Each of the three is guarded by what is already true, because both the
 * redirect and the webhook deliver the same charge and often at the same time.
 */
export const applyPaymentToOrder = async (db, orderId, { note = null, method = null } = {}, opts = {}) => {
  const before = await selectOne(
    db,
    'SELECT id, status, payment_status, customer_id FROM orders WHERE id = :orderId FOR UPDATE',
    { orderId },
    opts
  );
  if (!before) throw new OrderError('Order not found', 404);

  const confirming = before.status === 'pending';

  await db.query(
    `UPDATE orders SET
       payment_status = 'paid',
       payment_method = COALESCE(:method::payment_method, payment_method),
       status = CASE WHEN status = 'pending' THEN 'confirmed'::order_status ELSE status END
     WHERE id = :orderId`,
    { replacements: { orderId, method }, ...opts }
  );

  if (confirming) {
    if (note) {
      await db.query(
        `UPDATE order_status_events SET note = :note
          WHERE id = (SELECT id FROM order_status_events WHERE order_id = :orderId
                       ORDER BY created_at DESC, id DESC LIMIT 1)`,
        { replacements: { orderId, note }, ...opts }
      );
    }
    await postOrderConfirmed(db, orderId, opts);
  }

  if (before.payment_status !== 'paid') {
    await recordSaleMovements(db, orderId, null, opts);
  }

  return { customerId: before.customer_id, confirmed: confirming };
};

export const deleteOrder = async (orderId, db = getSequelize()) => {
  if (!isValidId(String(orderId ?? ''))) return false;

  const [, result] = await db.query('DELETE FROM orders WHERE id = :orderId', {
    replacements: { orderId },
  });
  return (result?.rowCount ?? 0) > 0;
};
