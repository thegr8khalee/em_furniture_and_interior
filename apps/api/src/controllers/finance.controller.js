import Order from '../models/order.model.js';

const parseDateRange = (startDate, endDate) => {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
};

const buildMatch = (start, end, includeUnpaid, includeRefunded) => {
  const match = {
    createdAt: { $gte: start, $lte: end },
  };

  if (!includeUnpaid) {
    match.paymentStatus = 'paid';
  }

  if (!includeRefunded) {
    match.status = { $nin: ['cancelled', 'refunded'] };
  }

  return match;
};

export const getRevenueSummary = async (req, res) => {
  try {
    const { startDate, endDate, includeUnpaid, includeRefunded } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = buildMatch(
      range.start,
      range.end,
      includeUnpaid === 'true',
      includeRefunded === 'true'
    );

    const [totals, daily] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            subtotal: { $sum: '$subtotal' },
            discount: { $sum: '$discount' },
            taxAmount: { $sum: '$taxAmount' },
            shippingCost: { $sum: '$shippingCost' },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            orderCount: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            subtotal: { $sum: '$subtotal' },
            discount: { $sum: '$discount' },
            taxAmount: { $sum: '$taxAmount' },
            shippingCost: { $sum: '$shippingCost' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const summary = totals[0] || {
      orderCount: 0,
      subtotal: 0,
      discount: 0,
      taxAmount: 0,
      shippingCost: 0,
      totalAmount: 0,
    };

    res.json({
      success: true,
      summary,
      daily,
      range: {
        start: range.start,
        end: range.end,
      },
    });
  } catch (error) {
    console.error('Error generating revenue summary:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const exportRevenueCsv = async (req, res) => {
  try {
    const { startDate, endDate, includeUnpaid, includeRefunded } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = buildMatch(
      range.start,
      range.end,
      includeUnpaid === 'true',
      includeRefunded === 'true'
    );

    const daily = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          orderCount: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          taxAmount: { $sum: '$taxAmount' },
          shippingCost: { $sum: '$shippingCost' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const header =
      'date,orders,subtotal,discount,tax,shipping,totalAmount\n';
    const rows = daily
      .map((row) =>
        [
          row._id,
          row.orderCount,
          row.subtotal || 0,
          row.discount || 0,
          row.taxAmount || 0,
          row.shippingCost || 0,
          row.totalAmount || 0,
        ].join(',')
      )
      .join('\n');

    const csv = `${header}${rows}`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="revenue-${range.start.toISOString().slice(0, 10)}-${range.end
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting revenue CSV:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
