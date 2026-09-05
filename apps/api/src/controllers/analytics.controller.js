import { logger } from '../lib/logger.js';
import { countConsultations, designerPerformance } from '../services/interiors.js';
import {
  conversionFunnel,
  customerLifetimeValue,
  overviewStats,
  parseDateRange,
  productPerformance,
  salesByCategory,
  salesByRegion,
} from '../services/reporting.js';

/*
 * The console's reports. Every one of these was a Mongo aggregation pipeline
 * over the orders collection; they are joins, and they live in
 * services/reporting.js as joins.
 */

const report = (load, where) => async (req, res) => {
  const range = parseDateRange(req.query.startDate, req.query.endDate);
  if (!range) return res.status(400).json({ message: 'Invalid date range.' });

  try {
    res.json({ success: true, ...(await load(range, req)), range });
  } catch (error) {
    logger.error({ err: error }, where);
    res.status(500).json({ message: 'Server error' });
  }
};

// Sales by Category
export const getSalesByCategory = report(
  async (range) => ({ data: await salesByCategory(range) }),
  'Error fetching sales by category'
);

// Sales by Region
export const getSalesByRegion = report(
  async (range) => ({ data: await salesByRegion(range) }),
  'Error fetching sales by region'
);

// Product Performance
export const getProductPerformance = report(
  async (range, req) => ({
    data: await productPerformance(range, {
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200),
    }),
  }),
  'Error fetching product performance'
);

// Designer Performance
export const getDesignerPerformance = report(
  async (range) => ({ data: await designerPerformance(range) }),
  'Error fetching designer performance'
);

// Customer Lifetime Value
export const getCustomerLifetimeValue = async (req, res) => {
  try {
    const data = await customerLifetimeValue({
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500),
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching customer LTV');
    res.status(500).json({ message: 'Server error' });
  }
};

// Conversion Funnel
export const getConversionFunnel = report(
  (range) => conversionFunnel(range),
  'Error fetching conversion funnel'
);

// Overview Dashboard Stats
export const getOverviewStats = report(async (range) => {
  const [stats, totalConsultations] = await Promise.all([
    overviewStats(range),
    countConsultations(range),
  ]);

  return { stats: { ...stats, totalConsultations } };
}, 'Error fetching overview stats');
