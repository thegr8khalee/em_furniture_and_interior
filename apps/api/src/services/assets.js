import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { isValidId } from './catalog.js';
import { toMajor, toMinor } from '../lib/money.js';
import { postAssetPurchase, postDepreciation } from './posting.js';

/**
 * What the business owns and wears out.
 *
 * A workshop full of tools, a delivery van, a set of machines — none of it was
 * in the books. Bought, it was either recorded as an expense in the month it was
 * bought, which destroys that month's profit and flatters every month after, or
 * not recorded at all, in which case the balance sheet said the business owned
 * nothing.
 *
 * The register capitalises the thing when it is bought and charges it to profit
 * a month at a time across its life. Straight line, because a small business
 * does not need declining balance and a method nobody can check by hand is
 * worse than one everybody can.
 */

export class AssetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AssetError';
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

/**
 * What one asset is charged in a month.
 *
 * Cost less residual, spread evenly, and never more than is left to charge: the
 * last month of an asset's life takes whatever rounding left behind, so the
 * accumulated total lands exactly on the depreciable amount rather than a kobo
 * either side of it for ever.
 */
const monthlyCharge = (asset) => {
  const depreciable = Number(asset.cost) - Number(asset.residual_value);
  const charged = Number(asset.charged ?? 0);
  const remaining = depreciable - charged;

  if (remaining <= 0) return 0;

  return Math.min(Math.floor(depreciable / asset.useful_life_months), remaining);
};

const publicAsset = (row) => {
  const cost = Number(row.cost);
  const charged = Number(row.charged ?? 0);

  return {
    _id: row.id,
    name: row.name,
    description: row.description,
    acquiredOn: row.acquired_on,
    cost: money(cost),
    residualValue: money(row.residual_value),
    usefulLifeMonths: row.useful_life_months,
    // What has been charged so far, and what is left on the balance sheet.
    depreciationToDate: money(charged),
    bookValue: money(cost - charged),
    monthlyCharge: money(monthlyCharge(row)),
    // How much of its life is used up, which is the figure that says whether
    // something is due for replacement.
    monthsCharged: Number(row.months_charged ?? 0),
    disposedOn: row.disposed_on,
    disposalNotes: row.disposal_notes,
    isFullyCharged: cost - charged <= Number(row.residual_value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const ASSET_SELECT = `
  SELECT a.id, a.name, a.description, a.acquired_on, a.cost, a.residual_value,
         a.useful_life_months, a.disposed_on, a.disposal_notes,
         a.created_at, a.updated_at,
         COALESCE(d.charged, 0)::bigint AS charged,
         COALESCE(d.months, 0)::int AS months_charged
    FROM fixed_assets a
    LEFT JOIN LATERAL (
      SELECT SUM(c.amount) AS charged, count(*)::int AS months
        FROM depreciation_charges c WHERE c.asset_id = a.id
    ) d ON true
`;

export const listAssets = async ({ includeDisposed = true } = {}, db = getSequelize()) => {
  const rows = await select(
    db,
    `${ASSET_SELECT}
     ${includeDisposed ? '' : 'WHERE a.disposed_on IS NULL'}
     ORDER BY a.disposed_on NULLS FIRST, a.acquired_on DESC`
  );

  const assets = rows.map(publicAsset);
  const inUse = assets.filter((asset) => !asset.disposedOn);

  return {
    assets,
    totals: {
      cost: inUse.reduce((total, asset) => total + Number(asset.cost), 0),
      depreciationToDate: inUse.reduce(
        (total, asset) => total + Number(asset.depreciationToDate),
        0
      ),
      bookValue: inUse.reduce((total, asset) => total + Number(asset.bookValue), 0),
      monthlyCharge: inUse.reduce((total, asset) => total + Number(asset.monthlyCharge), 0),
    },
  };
};

export const getAsset = async (id, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new AssetError('Asset not found.', 404);

  const row = await selectOne(db, `${ASSET_SELECT} WHERE a.id = :id`, { id });
  if (!row) throw new AssetError('Asset not found.', 404);

  const charges = await select(
    db,
    `SELECT period, amount FROM depreciation_charges
      WHERE asset_id = :id ORDER BY period DESC LIMIT 60`,
    { id }
  );

  return {
    ...publicAsset(row),
    charges: charges.map((charge) => ({
      period: charge.period,
      amount: money(charge.amount),
    })),
  };
};

/**
 * Registers something the business has bought.
 *
 * Capitalising it, which is the whole point: the money left the bank but the
 * value did not leave the business, so it moves from cash to `1500` rather than
 * to an expense. What it cost is charged to profit later, a month at a time.
 */
export const registerAsset = async (input, staffId = null, db = getSequelize()) => {
  const { name, acquiredOn, cost, usefulLifeMonths } = input ?? {};

  if (!name || !String(name).trim()) throw new AssetError('An asset needs a name.');
  if (!acquiredOn) throw new AssetError('An asset needs the date it was bought.');

  const amount = toMinor(Number(cost));
  const residual = toMinor(Number(input.residualValue || 0));
  const life = Number(usefulLifeMonths);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AssetError('What did it cost?');
  }
  if (!Number.isInteger(life) || life <= 0) {
    throw new AssetError('How many months will it last? A whole number, at least one.');
  }
  if (residual >= amount) {
    throw new AssetError('What it will be worth at the end has to be less than what it cost.');
  }

  const id = await db.transaction(async (transaction) => {
    const opts = { transaction };

    const asset = await selectOne(
      db,
      `INSERT INTO fixed_assets
         (name, description, acquired_on, cost, residual_value, useful_life_months, recorded_by)
       VALUES (:name, :description, :acquiredOn::date, :cost, :residual, :life, :staffId)
       RETURNING id`,
      {
        name: String(name).trim(),
        description: input.description || null,
        acquiredOn,
        cost: amount,
        residual,
        life,
        staffId: isValidId(String(staffId ?? '')) ? staffId : null,
      },
      opts
    );

    // Optional, because the purchase may already be in the books — paid through
    // a purchase order, or an expense recorded before anyone thought to
    // capitalise it. Posting it twice would double the asset.
    if (input.paidFrom) {
      await postAssetPurchase(db, asset.id, input.paidFrom, opts);
    }

    return asset.id;
  });

  return getAsset(id, db);
};

/**
 * Charges a month's depreciation across everything in use.
 *
 * Run once a month. Running it twice charges nothing twice — the unique index on
 * (asset, period) is what makes that true, rather than a check anyone could
 * forget — so it is safe to re-run when a month was half done or somebody is not
 * sure whether it was done at all.
 *
 * An asset bought during the month is charged from that month, whole. A part
 * month is not worth the arithmetic at this size, and charging from the month of
 * purchase is the convention most small businesses use.
 */
export const runDepreciation = async ({ month = null } = {}, db = getSequelize()) => {
  const period = monthOf(month ?? new Date());

  const assets = await select(
    db,
    `${ASSET_SELECT}
      WHERE a.acquired_on <= (:period::date + interval '1 month - 1 day')
        AND (a.disposed_on IS NULL OR a.disposed_on > :period::date)`,
    { period }
  );

  const charged = [];
  let total = 0;

  for (const asset of assets) {
    const amount = monthlyCharge(asset);
    if (amount <= 0) continue;

    const written = await db.transaction(async (transaction) => {
      const opts = { transaction };

      const charge = await selectOne(
        db,
        `INSERT INTO depreciation_charges (asset_id, period, amount)
         VALUES (:assetId, :period::date, :amount)
         ON CONFLICT (asset_id, period) DO NOTHING
         RETURNING id`,
        { assetId: asset.id, period, amount },
        opts
      );

      // Already charged for this month. Not an error: re-running a month is
      // the ordinary way to finish one that was interrupted.
      if (!charge) return null;

      await postDepreciation(db, charge.id, opts);
      return charge.id;
    });

    if (written) {
      charged.push({ assetId: asset.id, name: asset.name, amount: money(amount) });
      total += amount;
    }
  }

  return {
    period,
    charged: charged.length,
    skipped: assets.length - charged.length,
    total: money(total),
    assets: charged,
  };
};

/**
 * Takes an asset out of use.
 *
 * The register stops charging it. What the disposal did to the books — a sale, a
 * write-off, a part exchange — is a judgement with too many shapes to guess at,
 * so it is left to a manual entry rather than posted from a guess.
 */
export const disposeAsset = async (id, { disposedOn = null, notes = null } = {}, db = getSequelize()) => {
  if (!isValidId(String(id ?? ''))) throw new AssetError('Asset not found.', 404);

  const row = await selectOne(
    db,
    `UPDATE fixed_assets
        SET disposed_on = COALESCE(:disposedOn::date, CURRENT_DATE), disposal_notes = :notes
      WHERE id = :id AND disposed_on IS NULL
      RETURNING id`,
    { id, disposedOn: disposedOn || null, notes: notes || null }
  ).catch((error) => {
    if (error?.original?.constraint === 'fixed_asset_disposal_follows_acquisition') {
      throw new AssetError('It cannot have been disposed of before it was bought.');
    }
    throw error;
  });

  if (!row) {
    const existing = await selectOne(db, 'SELECT disposed_on FROM fixed_assets WHERE id = :id', {
      id,
    });
    if (!existing) throw new AssetError('Asset not found.', 404);
    throw new AssetError('This asset has already been disposed of.');
  }

  return getAsset(id, db);
};
