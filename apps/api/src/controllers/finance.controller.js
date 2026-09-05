import { logger } from '../lib/logger.js';
import { parseDateRange, revenueSummary } from '../services/reporting.js';

/*
 * Revenue, summarised and exported. Both endpoints ask the same question of
 * services/reporting.js and differ only in how they render the answer, which is
 * what stops the CSV and the screen from disagreeing — under Mongo they were
 * two copies of one aggregation pipeline.
 */

const options = (req) => ({
  includeUnpaid: req.query.includeUnpaid === 'true',
  includeRefunded: req.query.includeRefunded === 'true',
});

export const getRevenueSummary = async (req, res) => {
  const range = parseDateRange(req.query.startDate, req.query.endDate);
  if (!range) return res.status(400).json({ message: 'Invalid date range.' });

  try {
    const { summary, daily } = await revenueSummary(range, options(req));

    res.json({ success: true, summary, daily, range });
  } catch (error) {
    logger.error({ err: error }, 'Error generating revenue summary');
    res.status(500).json({ message: 'Server error' });
  }
};

const CSV_COLUMNS = ['date', 'orders', 'subtotal', 'discount', 'tax', 'shipping', 'totalAmount'];

export const exportRevenueCsv = async (req, res) => {
  const range = parseDateRange(req.query.startDate, req.query.endDate);
  if (!range) return res.status(400).json({ message: 'Invalid date range.' });

  try {
    const { daily } = await revenueSummary(range, options(req));

    const rows = daily.map((row) =>
      [
        row._id,
        row.orderCount,
        row.subtotal,
        row.discount,
        row.taxAmount,
        row.shippingCost,
        row.totalAmount,
      ].join(',')
    );

    const from = range.start.toISOString().slice(0, 10);
    const to = range.end.toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${from}-${to}.csv"`);
    res.status(200).send(`${CSV_COLUMNS.join(',')}\n${rows.join('\n')}`);
  } catch (error) {
    logger.error({ err: error }, 'Error exporting revenue CSV');
    res.status(500).json({ message: 'Server error' });
  }
};
