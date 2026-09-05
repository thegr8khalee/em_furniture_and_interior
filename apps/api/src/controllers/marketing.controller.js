import { logger } from '../lib/logger.js';
import {
  MarketingError,
  createBanner as createBannerRow,
  createFlashSale as createFlashSaleRow,
  deleteBanner as deleteBannerRow,
  deleteFlashSale as deleteFlashSaleRow,
  listBanners,
  listFlashSales,
  updateBanner as updateBannerRow,
  updateFlashSale as updateFlashSaleRow,
} from '../services/marketing.js';

/*
 * Promo banners and flash sales.
 *
 * "Live right now" is a WHERE clause in services/marketing.js. These endpoints
 * used to load every active row and filter the window in JavaScript, which made
 * the decision twice — once in the query and once in a helper — and the two
 * could disagree about an inclusive end date.
 */

const fail = (error, res, where) => {
  if (error instanceof MarketingError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

// Promo Banners
export const getAdminBanners = async (_req, res) => {
  try {
    res.json({ success: true, banners: await listBanners() });
  } catch (error) {
    fail(error, res, 'Error fetching promo banners');
  }
};

export const getActiveBanners = async (req, res) => {
  try {
    const banners = await listBanners({ liveOnly: true, position: req.query.position || null });
    res.json({ success: true, banners });
  } catch (error) {
    fail(error, res, 'Error fetching active promo banners');
  }
};

export const createBanner = async (req, res) => {
  try {
    res.status(201).json({ success: true, banner: await createBannerRow(req.body) });
  } catch (error) {
    fail(error, res, 'Error creating promo banner');
  }
};

export const updateBanner = async (req, res) => {
  try {
    const banner = await updateBannerRow(req.params.bannerId, req.body);
    res.json({ success: true, banner });
  } catch (error) {
    fail(error, res, 'Error updating promo banner');
  }
};

export const deleteBanner = async (req, res) => {
  try {
    if (!(await deleteBannerRow(req.params.bannerId))) {
      return res.status(404).json({ message: 'Banner not found.' });
    }
    res.json({ success: true, message: 'Banner deleted successfully.' });
  } catch (error) {
    fail(error, res, 'Error deleting promo banner');
  }
};

// Flash Sales
export const getAdminFlashSales = async (_req, res) => {
  try {
    res.json({ success: true, flashSales: await listFlashSales() });
  } catch (error) {
    fail(error, res, 'Error fetching flash sales');
  }
};

export const getActiveFlashSales = async (_req, res) => {
  try {
    res.json({ success: true, flashSales: await listFlashSales({ liveOnly: true }) });
  } catch (error) {
    fail(error, res, 'Error fetching active flash sales');
  }
};

export const createFlashSale = async (req, res) => {
  try {
    res.status(201).json({ success: true, flashSale: await createFlashSaleRow(req.body) });
  } catch (error) {
    fail(error, res, 'Error creating flash sale');
  }
};

export const updateFlashSale = async (req, res) => {
  try {
    const flashSale = await updateFlashSaleRow(req.params.flashSaleId, req.body);
    res.json({ success: true, flashSale });
  } catch (error) {
    fail(error, res, 'Error updating flash sale');
  }
};

export const deleteFlashSale = async (req, res) => {
  try {
    if (!(await deleteFlashSaleRow(req.params.flashSaleId))) {
      return res.status(404).json({ message: 'Flash sale not found.' });
    }
    res.json({ success: true, message: 'Flash sale deleted successfully.' });
  } catch (error) {
    fail(error, res, 'Error deleting flash sale');
  }
};
