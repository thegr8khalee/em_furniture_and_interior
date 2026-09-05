import ConsultationRequest from '../models/consultationRequest.model.js';
import { logger } from '../lib/logger.js';
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
 *
 * Designer performance is the exception below: consultations and designers are
 * still Mongo collections, so it stays an aggregation until they move.
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
export const getDesignerPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
      assignedDesigner: { $ne: null },
    };

    const designerPerformance = await ConsultationRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$assignedDesigner',
          totalConsultations: { $sum: 1 },
          completedConsultations: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          scheduledConsultations: {
            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] },
          },
          cancelledConsultations: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'designers',
          localField: '_id',
          foreignField: '_id',
          as: 'designerDetails',
        },
      },
      { $unwind: { path: '$designerDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          designerId: '$_id',
          designerName: '$designerDetails.name',
          totalConsultations: 1,
          completedConsultations: 1,
          scheduledConsultations: 1,
          cancelledConsultations: 1,
          completionRate: {
            $cond: [
              { $gt: ['$totalConsultations', 0] },
              {
                $multiply: [
                  { $divide: ['$completedConsultations', '$totalConsultations'] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { completedConsultations: -1 } },
    ]);

    res.json({
      success: true,
      data: designerPerformance,
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching designer performance');
    res.status(500).json({ message: 'Server error' });
  }
};

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
    // Still a Mongo collection. Counted separately rather than pretending it is
    // part of the same query, and zero rather than a failed dashboard if the
    // collection is unreachable.
    ConsultationRequest.countDocuments({
      createdAt: { $gte: range.start, $lte: range.end },
    }).catch(() => 0),
  ]);

  return { stats: { ...stats, totalConsultations } };
}, 'Error fetching overview stats');
