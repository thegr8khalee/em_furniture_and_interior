import { logger } from '../lib/logger.js';
import {
  AssetError,
  disposeAsset,
  getAsset,
  listAssets,
  registerAsset,
  runDepreciation,
} from '../services/assets.js';

/*
 * The things the business owns, and the monthly charge for using them.
 */

const fail = (error, res, where) => {
  if (error instanceof AssetError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getAssets = async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await listAssets({ includeDisposed: req.query.inUse !== 'true' })),
    });
  } catch (error) {
    fail(error, res, 'Error listing assets');
  }
};

export const getOneAsset = async (req, res) => {
  try {
    res.json({ success: true, asset: await getAsset(req.params.assetId) });
  } catch (error) {
    fail(error, res, 'Error loading an asset');
  }
};

export const postAsset = async (req, res) => {
  try {
    const asset = await registerAsset(req.body, req.admin?.id ?? null);
    res.status(201).json({ success: true, asset, message: `${asset.name} is on the register.` });
  } catch (error) {
    fail(error, res, 'Error registering an asset');
  }
};

/**
 * Charges a month across everything in use.
 *
 * Safe to re-run: a month already charged is skipped rather than charged twice.
 */
export const postDepreciationRun = async (req, res) => {
  try {
    const result = await runDepreciation({ month: req.body?.month || null });

    res.json({
      success: true,
      ...result,
      message: result.charged
        ? `Charged ${result.charged} asset${result.charged === 1 ? '' : 's'}, ₦${Number(
            result.total
          ).toLocaleString()} in total.`
        : 'Nothing to charge — that month is already done.',
    });
  } catch (error) {
    fail(error, res, 'Error running depreciation');
  }
};

export const postAssetDisposal = async (req, res) => {
  try {
    const asset = await disposeAsset(req.params.assetId, {
      disposedOn: req.body?.disposedOn || null,
      notes: req.body?.notes || null,
    });

    res.json({
      success: true,
      asset,
      message: `${asset.name} is out of use. What the disposal did to the books is a manual entry.`,
    });
  } catch (error) {
    fail(error, res, 'Error disposing of an asset');
  }
};
