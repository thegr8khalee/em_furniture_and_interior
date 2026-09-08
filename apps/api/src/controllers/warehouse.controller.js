import { logger } from '../lib/logger.js';
import {
  WarehouseError,
  abandonStockTake,
  applyStockTake,
  createLocation,
  getStockTake,
  listLocations,
  listStockTakes,
  recordCount,
  reorderSuggestions,
  startStockTake,
  stockByLocation,
  transferStock,
  updateLocation,
} from '../services/warehouse.js';

/*
 * Where stock is, whether it is really there, and what to buy next.
 */

const fail = (error, res, where) => {
  if (error instanceof WarehouseError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getLocations = async (req, res) => {
  try {
    res.json({ success: true, locations: await listLocations() });
  } catch (error) {
    fail(error, res, 'Error listing locations');
  }
};

export const postLocation = async (req, res) => {
  try {
    res.status(201).json({ success: true, location: await createLocation(req.body) });
  } catch (error) {
    fail(error, res, 'Error creating a location');
  }
};

export const patchLocation = async (req, res) => {
  try {
    res.json({ success: true, location: await updateLocation(req.params.locationId, req.body) });
  } catch (error) {
    fail(error, res, 'Error updating a location');
  }
};

export const getStockByLocation = async (req, res) => {
  try {
    res.json({
      success: true,
      stock: await stockByLocation({ locationId: req.query.location || null }),
    });
  } catch (error) {
    fail(error, res, 'Error listing stock by location');
  }
};

export const postTransfer = async (req, res) => {
  try {
    const result = await transferStock(
      {
        productId: req.body?.product,
        fromLocationId: req.body?.from,
        toLocationId: req.body?.to,
        quantity: req.body?.quantity,
        note: req.body?.note || null,
      },
      req.admin?.id ?? null
    );

    res.status(201).json({
      success: true,
      ...result,
      message: `${result.quantity} moved. Nothing posts: the value did not change, only its address.`,
    });
  } catch (error) {
    fail(error, res, 'Error transferring stock');
  }
};

export const getStockTakes = async (req, res) => {
  try {
    res.json({ success: true, stockTakes: await listStockTakes() });
  } catch (error) {
    fail(error, res, 'Error listing stock takes');
  }
};

export const getOneStockTake = async (req, res) => {
  try {
    res.json({ success: true, stockTake: await getStockTake(req.params.takeId) });
  } catch (error) {
    fail(error, res, 'Error loading a stock take');
  }
};

export const postStockTake = async (req, res) => {
  try {
    const stockTake = await startStockTake(
      {
        locationId: req.body?.location,
        countedOn: req.body?.countedOn || null,
        notes: req.body?.notes || null,
      },
      req.admin?.id ?? null
    );

    res.status(201).json({
      success: true,
      stockTake,
      message: `${stockTake.lineCount} lines to count.`,
    });
  } catch (error) {
    fail(error, res, 'Error starting a stock take');
  }
};

export const putCounts = async (req, res) => {
  try {
    res.json({
      success: true,
      stockTake: await recordCount(req.params.takeId, req.body?.counts),
      message: 'Counts saved.',
    });
  } catch (error) {
    fail(error, res, 'Error recording counts');
  }
};

export const postStockTakeApplication = async (req, res) => {
  try {
    const stockTake = await applyStockTake(req.params.takeId, req.admin?.id ?? null);

    res.json({
      success: true,
      stockTake,
      message: `Applied. ${stockTake.variance >= 0 ? 'Found' : 'Lost'} ${Math.abs(
        stockTake.variance
      )} items in total.`,
    });
  } catch (error) {
    fail(error, res, 'Error applying a stock take');
  }
};

export const postStockTakeAbandonment = async (req, res) => {
  try {
    res.json({ success: true, stockTake: await abandonStockTake(req.params.takeId) });
  } catch (error) {
    fail(error, res, 'Error abandoning a stock take');
  }
};

export const getReorderSuggestions = async (req, res) => {
  try {
    res.json({ success: true, ...(await reorderSuggestions({ days: req.query.days || 90 })) });
  } catch (error) {
    fail(error, res, 'Error working out what to reorder');
  }
};
