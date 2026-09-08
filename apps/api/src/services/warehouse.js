import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor } from '../lib/money.js';
import { postStockMovement } from './posting.js';

/**
 * Where the stock is, whether it is really there, and what to buy next.
 *
 * Three things that were missing from the same place.
 *
 * `warehouse_location` was free text on the product — one string for something
 * that might sit in two places — so "we have twelve" could not tell twelve in
 * the showroom from twelve in a container nobody can reach today.
 *
 * Stock could be corrected one product at a time. A stock take is not that: it
 * is counting everything on one day and explaining the differences, and doing it
 * as forty separate adjustments loses the fact that they were one count.
 *
 * And `low_stock_threshold` and `lead_time_days` have been on every product
 * since the catalog was migrated with nothing ever reading them.
 */

export class WarehouseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'WarehouseError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

const money = (kobo) => toMajor(Number(kobo ?? 0));

// ---------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------

const publicLocation = (row) => ({
  _id: row.id,
  name: row.name,
  address: row.address,
  isSellable: row.is_sellable,
  isDefault: row.is_default,
  isActive: row.is_active,
  onHand: row.on_hand === undefined ? undefined : Number(row.on_hand),
  lines: row.lines === undefined ? undefined : Number(row.lines),
});

export const listLocations = async (db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT l.id, l.name, l.address, l.is_sellable, l.is_default, l.is_active,
            COALESCE(m.on_hand, 0)::int AS on_hand,
            COALESCE(m.lines, 0)::int AS lines
       FROM stock_locations l
       LEFT JOIN LATERAL (
         SELECT SUM(quantity)::int AS on_hand,
                count(DISTINCT product_id)::int AS lines
           FROM stock_movements WHERE location_id = l.id
       ) m ON true
      ORDER BY l.is_default DESC, l.name`
  );

  return rows.map(publicLocation);
};

export const createLocation = async (input, db = getSequelize()) => {
  const { name } = input ?? {};
  if (!name || !String(name).trim()) throw new WarehouseError('A location needs a name.');

  const row = await selectOne(
    db,
    `INSERT INTO stock_locations (name, address, is_sellable)
     VALUES (:name, :address, :isSellable)
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name, address, is_sellable, is_default, is_active`,
    {
      name: String(name).trim(),
      address: input.address || null,
      // Somewhere stock can be sold from unless told otherwise; a container at
      // the port is the exception, not the rule.
      isSellable: input.isSellable === undefined ? true : Boolean(input.isSellable),
    }
  );

  if (!row) throw new WarehouseError(`There is already a location called ${name}.`);
  return publicLocation(row);
};

export const updateLocation = async (id, input, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new WarehouseError('Location not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE stock_locations SET
       name = COALESCE(:name, name),
       address = CASE WHEN :addressGiven THEN :address ELSE address END,
       is_sellable = COALESCE(:isSellable, is_sellable),
       is_active = COALESCE(:isActive, is_active)
     WHERE id = :id
     RETURNING id, name, address, is_sellable, is_default, is_active`,
    {
      id,
      name: input.name ?? null,
      addressGiven: input.address !== undefined,
      address: input.address ?? null,
      isSellable: typeof input.isSellable === 'boolean' ? input.isSellable : null,
      isActive: typeof input.isActive === 'boolean' ? input.isActive : null,
    }
  );

  if (!row) throw new WarehouseError('Location not found.', 404);
  return publicLocation(row);
};

/** What is where: one row per product per location that holds any. */
export const stockByLocation = async ({ locationId = null } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `SELECT l.id AS location_id, l.name AS location_name, l.is_sellable,
            p.id AS product_id, s.name AS product_name, p.sku,
            SUM(m.quantity)::int AS on_hand
       FROM stock_movements m
       JOIN stock_locations l ON l.id = m.location_id
       JOIN products p ON p.id = m.product_id
       JOIN sellable_items s ON s.id = p.id
      ${locationId ? 'WHERE l.id = :locationId' : ''}
      GROUP BY l.id, l.name, l.is_sellable, p.id, s.name, p.sku
     HAVING SUM(m.quantity) <> 0
      ORDER BY l.name, s.name`,
    { locationId }
  );

  return rows.map((row) => ({
    location: {
      _id: row.location_id,
      name: row.location_name,
      isSellable: row.is_sellable,
    },
    product: { _id: row.product_id, name: row.product_name, sku: row.sku },
    onHand: Number(row.on_hand),
  }));
};

/**
 * Moves stock from one place to another.
 *
 * Two movements written together, out of one and into the other, sharing a
 * group so they can never be read apart. A `transfer_out` with no matching
 * `transfer_in` would leave stock nowhere — on no shelf and in no total — which
 * is worse than not recording the move at all.
 *
 * Nothing is posted: the value has not changed, only its address. The posting
 * rules already say so by mapping both transfer reasons to no entry.
 */
export const transferStock = async (
  { productId, fromLocationId, toLocationId, quantity, note = null },
  staffId = null,
  db = getSequelize()
) => {
  if (!isValidId(String(productId ?? ''))) throw new WarehouseError('Product not found.', 404);
  if (!isValidId(String(fromLocationId ?? '')) || !isValidId(String(toLocationId ?? ''))) {
    throw new WarehouseError('Both a from and a to location are needed.');
  }
  if (fromLocationId === toLocationId) {
    throw new WarehouseError('That is the same place.');
  }

  const count = Number(quantity);
  if (!Number.isInteger(count) || count <= 0) {
    throw new WarehouseError('A transfer needs a whole number of items, at least one.');
  }

  return db.transaction(async (transaction) => {
    const opts = { transaction };

    const held = await selectOne(
      db,
      `SELECT COALESCE(SUM(quantity), 0)::int AS on_hand
         FROM stock_movements
        WHERE product_id = :productId AND location_id = :fromLocationId`,
      { productId, fromLocationId },
      opts
    );

    if (Number(held.on_hand) < count) {
      throw new WarehouseError(
        `There are only ${held.on_hand} there. Moving more than exists would put stock in two places at once.`
      );
    }

    const group = await selectOne(db, 'SELECT gen_random_uuid() AS id', {}, opts);

    await db.query(
      `INSERT INTO stock_movements
         (product_id, quantity, reason, location_id, transfer_group, staff_id, note)
       VALUES
         (:productId, :out, 'transfer_out', :fromLocationId, :group, :staffId, :note),
         (:productId, :in, 'transfer_in', :toLocationId, :group, :staffId, :note)`,
      {
        replacements: {
          productId,
          out: -count,
          in: count,
          fromLocationId,
          toLocationId,
          group: group.id,
          staffId: isValidId(String(staffId ?? '')) ? staffId : null,
          note: note || 'Transferred',
        },
        ...opts,
      }
    );

    return { productId, quantity: count, transferGroup: group.id };
  });
};

// ---------------------------------------------------------------------------
// Counting it
// ---------------------------------------------------------------------------

const publicTake = (row) => ({
  _id: row.id,
  location: { _id: row.location_id, name: row.location_name },
  countedOn: row.counted_on,
  status: row.status,
  notes: row.notes,
  countedBy: row.counted_by,
  appliedBy: row.applied_by,
  appliedAt: row.applied_at,
  lineCount: Number(row.line_count ?? 0),
  countedLines: Number(row.counted_lines ?? 0),
  // The figure the whole exercise is for: how far the shelf is from the book.
  variance: Number(row.variance ?? 0),
  createdAt: row.created_at,
});

const TAKE_SELECT = `
  SELECT t.id, t.location_id, l.name AS location_name, t.counted_on, t.status,
         t.notes, t.counted_by, t.applied_by, t.applied_at, t.created_at,
         COALESCE(c.line_count, 0)::int AS line_count,
         COALESCE(c.counted_lines, 0)::int AS counted_lines,
         COALESCE(c.variance, 0)::int AS variance
    FROM stock_takes t
    JOIN stock_locations l ON l.id = t.location_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS line_count,
             count(counted)::int AS counted_lines,
             SUM(COALESCE(counted, expected) - expected)::int AS variance
        FROM stock_take_lines WHERE stock_take_id = t.id
    ) c ON true
`;

export const listStockTakes = async (db = getSequelize()) => {
  const rows = await select(db, `${TAKE_SELECT} ORDER BY t.counted_on DESC, t.created_at DESC`);
  return rows.map(publicTake);
};

export const getStockTake = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new WarehouseError('Stock take not found.', 404);

  const row = await selectOne(db, `${TAKE_SELECT} WHERE t.id = :id`, { id });
  if (!row) throw new WarehouseError('Stock take not found.', 404);

  const lines = await select(
    db,
    `SELECT tl.id, tl.expected, tl.counted, tl.note,
            p.id AS product_id, s.name AS product_name, p.sku, s.cost_price
       FROM stock_take_lines tl
       JOIN products p ON p.id = tl.product_id
       JOIN sellable_items s ON s.id = p.id
      WHERE tl.stock_take_id = :id
      ORDER BY s.name`,
    { id }
  );

  return {
    ...publicTake(row),
    lines: lines.map((line) => {
      const counted = line.counted === null ? null : Number(line.counted);
      const variance = counted === null ? null : counted - Number(line.expected);

      return {
        _id: line.id,
        product: { _id: line.product_id, name: line.product_name, sku: line.sku },
        expected: Number(line.expected),
        counted,
        variance,
        // What the difference is worth, which is what the write-off will cost.
        varianceValue:
          variance === null || line.cost_price === null
            ? null
            : money(variance * Number(line.cost_price)),
        note: line.note,
      };
    }),
  };
};

/**
 * Opens a count sheet for a location.
 *
 * The expected figures are frozen onto the sheet as it is drawn up. The variance
 * is against what was expected when counting began — a sale during the count
 * must not quietly change the number the counter was checking against.
 */
export const startStockTake = async (
  { locationId, countedOn = null, notes = null },
  staffId = null,
  db = getSequelize()
) => {
  if (!isValidId(String(locationId ?? ''))) throw new WarehouseError('Location not found.', 404);

  const id = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const open = await selectOne(
      db,
      `SELECT id FROM stock_takes WHERE location_id = :locationId AND status = 'counting'`,
      { locationId },
      opts
    );
    if (open) {
      throw new WarehouseError('There is already a count open for that location.');
    }

    const take = await selectOne(
      db,
      `INSERT INTO stock_takes (location_id, counted_on, notes, counted_by)
       VALUES (:locationId, COALESCE(:countedOn::date, CURRENT_DATE), :notes, :staffId)
       RETURNING id`,
      {
        locationId,
        countedOn: countedOn || null,
        notes,
        staffId: isValidId(String(staffId ?? '')) ? staffId : null,
      },
      opts
    );

    // Everything that location holds, plus everything it has ever held — a
    // product that should be there and is not is exactly what a count is for,
    // and a sheet that omits it cannot report it missing.
    await db.query(
      `INSERT INTO stock_take_lines (stock_take_id, product_id, expected)
       SELECT :takeId, m.product_id, COALESCE(SUM(m.quantity), 0)::int
         FROM stock_movements m
        WHERE m.location_id = :locationId
        GROUP BY m.product_id`,
      { replacements: { takeId: take.id, locationId }, ...opts }
    );

    return take.id;
  });

  return getStockTake(id, db);
};

/** Records what was actually on the shelf. */
export const recordCount = async (takeId, counts, db = getSequelize()) => {
  if (!isValidId(String(takeId ?? ''))) throw new WarehouseError('Stock take not found.', 404);
  if (!Array.isArray(counts) || counts.length === 0) {
    throw new WarehouseError('There are no counts to record.');
  }

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const take = await selectOne(
      db,
      'SELECT id, status FROM stock_takes WHERE id = :takeId FOR UPDATE',
      { takeId },
      opts
    );
    if (!take) throw new WarehouseError('Stock take not found.', 404);
    if (take.status !== 'counting') {
      throw new WarehouseError(`This count is already ${take.status}.`);
    }

    for (const entry of counts) {
      const counted = Number(entry.counted);
      if (!Number.isInteger(counted) || counted < 0) {
        throw new WarehouseError('A count has to be a whole number, and cannot be negative.');
      }

      await db.query(
        `UPDATE stock_take_lines SET counted = :counted, note = :note
          WHERE stock_take_id = :takeId AND product_id = :productId`,
        {
          replacements: {
            takeId,
            productId: entry.productId,
            counted,
            note: entry.note || null,
          },
          ...opts,
        }
      );
    }
  });

  return getStockTake(takeId, db);
};

/**
 * Applies the count, writing one adjustment for each difference.
 *
 * The adjustments carry the count's own reference, so a year later the movement
 * log still says these forty corrections were one stock take rather than forty
 * separate decisions somebody made on a Tuesday.
 *
 * A line nobody counted is left alone. Treating an uncounted line as zero would
 * write off everything the counter did not get to.
 */
export const applyStockTake = async (takeId, staffId = null, db = getSequelize()) => {
  if (!isValidId(String(takeId ?? ''))) throw new WarehouseError('Stock take not found.', 404);

  await db.transaction(async (transaction) => {
    const opts = { transaction };

    const take = await selectOne(
      db,
      `SELECT t.id, t.status, t.location_id, t.counted_on
         FROM stock_takes t WHERE t.id = :takeId FOR UPDATE`,
      { takeId },
      opts
    );
    if (!take) throw new WarehouseError('Stock take not found.', 404);
    if (take.status !== 'counting') {
      throw new WarehouseError(`This count is already ${take.status}.`);
    }

    const differences = await select(
      db,
      `SELECT product_id, expected, counted
         FROM stock_take_lines
        WHERE stock_take_id = :takeId AND counted IS NOT NULL AND counted <> expected`,
      { takeId },
      opts
    );

    for (const line of differences) {
      const delta = Number(line.counted) - Number(line.expected);

      const movement = await selectOne(
        db,
        `INSERT INTO stock_movements
           (product_id, quantity, reason, location_id, staff_id, note, occurred_at)
         VALUES (:productId, :delta, 'adjustment', :locationId, :staffId, :note, :countedOn::date)
         RETURNING id`,
        {
          productId: line.product_id,
          delta,
          locationId: take.location_id,
          staffId: isValidId(String(staffId ?? '')) ? staffId : null,
          note: `Stock take ${String(take.counted_on)}: counted ${line.counted}, expected ${line.expected}`,
          countedOn: take.counted_on,
        },
        opts
      );

      // A difference is a real gain or loss of value, so it posts like any
      // other adjustment: stock written off, or found.
      await postStockMovement(db, movement.id, opts);
    }

    await db.query(
      `UPDATE stock_takes
          SET status = 'applied', applied_by = :staffId, applied_at = now()
        WHERE id = :takeId`,
      { replacements: { takeId, staffId: isValidId(String(staffId ?? '')) ? staffId : null }, ...opts }
    );
  });

  return getStockTake(takeId, db);
};

export const abandonStockTake = async (takeId, db = getSequelize()) => {
  if (!isValidId(String(takeId ?? ''))) throw new WarehouseError('Stock take not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE stock_takes SET status = 'abandoned'
      WHERE id = :takeId AND status = 'counting' RETURNING id`,
    { takeId }
  );

  if (!row) {
    const existing = await selectOne(db, 'SELECT status FROM stock_takes WHERE id = :takeId', {
      takeId,
    });
    if (!existing) throw new WarehouseError('Stock take not found.', 404);
    throw new WarehouseError(`A count that is ${existing.status} cannot be abandoned.`);
  }

  return getStockTake(takeId, db);
};

// ---------------------------------------------------------------------------
// What to buy
// ---------------------------------------------------------------------------

/**
 * What to reorder, and how urgently.
 *
 * `low_stock_threshold` and `lead_time_days` have been on every product since
 * the catalog was migrated and nothing has ever read them. This is what they
 * were for.
 *
 * Urgency is the honest question: not "is it below the line" but "will it run
 * out before more arrives". A product selling three a week with four in stock
 * and a twenty-one day lead time is already too late, and one selling nothing
 * is not urgent however empty the shelf is.
 */
export const reorderSuggestions = async ({ days = 90 } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `WITH sold AS (
       SELECT m.product_id, SUM(-m.quantity)::int AS units
         FROM stock_movements m
        WHERE m.reason = 'sale'
          AND m.occurred_at >= now() - (:days || ' days')::interval
        GROUP BY m.product_id
     )
     SELECT p.id, s.name, p.sku, p.low_stock_threshold, p.lead_time_days,
            av.on_hand, av.available, av.reserved,
            COALESCE(sold.units, 0) AS sold,
            s.cost_price,
            -- What a supplier is already bringing. Ordering again because the
            -- first order has not arrived is how a shop ends up with a year of
            -- stock and no cash.
            COALESCE(incoming.quantity, 0)::int AS on_order
       FROM products p
       JOIN sellable_items s ON s.id = p.id
       JOIN product_availability av ON av.product_id = p.id
       LEFT JOIN sold ON sold.product_id = p.id
       LEFT JOIN LATERAL (
         SELECT SUM(i.quantity)::int AS quantity
           FROM purchase_order_items i
           JOIN purchase_orders po ON po.id = i.purchase_order_id
          WHERE i.product_id = p.id AND po.status IN ('draft', 'sent')
       ) incoming ON true
      ORDER BY s.name`,
    { days: Number(days) || 90 }
  );

  const window = Number(days) || 90;

  const suggestions = rows
    .map((row) => {
      const available = Number(row.available);
      const sold = Number(row.sold);
      const leadTime = Number(row.lead_time_days) || 0;
      const threshold = Number(row.low_stock_threshold) || 0;
      const onOrder = Number(row.on_order);

      // Units a day, from what actually sold rather than from a forecast.
      const daily = sold / window;
      const daysOfCover = daily > 0 ? Math.floor(available / daily) : null;

      // What will be needed before a new order could arrive, plus the buffer the
      // threshold represents.
      const needed = Math.max(
        0,
        Math.ceil(daily * leadTime) + threshold - available - onOrder
      );

      const urgency =
        daysOfCover === null
          ? available <= threshold && sold === 0
            ? 'idle'
            : 'fine'
          : daysOfCover <= leadTime
            ? 'late'
            : daysOfCover <= leadTime * 2
              ? 'soon'
              : 'fine';

      return {
        product: { _id: row.id, name: row.name, sku: row.sku },
        available,
        reserved: Number(row.reserved),
        onOrder,
        threshold,
        leadTimeDays: leadTime,
        soldInWindow: sold,
        dailyRate: Math.round(daily * 100) / 100,
        daysOfCover,
        suggestedQuantity: needed,
        estimatedCost: row.cost_price ? money(needed * Number(row.cost_price)) : null,
        urgency,
      };
    })
    // Only what actually wants buying: something already covered, or on order,
    // or that nobody is asking for, is noise on this screen.
    .filter((row) => row.suggestedQuantity > 0 || row.urgency === 'late')
    .sort((a, b) => {
      const order = { late: 0, soon: 1, idle: 2, fine: 3 };
      if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
      return (a.daysOfCover ?? 9999) - (b.daysOfCover ?? 9999);
    });

  return {
    window,
    suggestions,
    totals: {
      products: suggestions.length,
      late: suggestions.filter((row) => row.urgency === 'late').length,
      estimatedCost: suggestions.reduce((total, row) => total + Number(row.estimatedCost ?? 0), 0),
    },
  };
};
