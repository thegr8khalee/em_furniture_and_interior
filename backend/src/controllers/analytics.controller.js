import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import ConsultationRequest from '../models/consultationRequest.model.js';

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

// Sales by Category
export const getSalesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
      status: { $nin: ['cancelled', 'refunded'] },
      paymentStatus: 'paid',
    };

    const salesByCategory = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.item',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productDetails.category',
          totalRevenue: { $sum: '$items.subtotal' },
          orderCount: { $sum: 1 },
          itemCount: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({
      success: true,
      data: salesByCategory,
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error('Error fetching sales by category:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Sales by Region
export const getSalesByRegion = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
      status: { $nin: ['cancelled', 'refunded'] },
      paymentStatus: 'paid',
    };

    const salesByRegion = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            state: '$shippingAddress.state',
            city: '$shippingAddress.city',
          },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 50 },
    ]);

    res.json({
      success: true,
      data: salesByRegion,
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error('Error fetching sales by region:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Product Performance
export const getProductPerformance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
      status: { $nin: ['cancelled', 'refunded'] },
      paymentStatus: 'paid',
    };

    const productPerformance = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.item',
          productName: { $first: '$items.name' },
          totalRevenue: { $sum: '$items.subtotal' },
          unitsSold: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    res.json({
      success: true,
      data: productPerformance,
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error('Error fetching product performance:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

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
    console.error('Error fetching designer performance:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Customer Lifetime Value
export const getCustomerLifetimeValue = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const customerLTV = await Order.aggregate([
      {
        $match: {
          user: { $ne: null },
          status: { $nin: ['cancelled', 'refunded'] },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          userName: {
            $concat: [
              '$userDetails.firstName',
              ' ',
              '$userDetails.lastName',
            ],
          },
          email: '$userDetails.email',
          totalSpent: 1,
          orderCount: 1,
          averageOrderValue: 1,
          firstOrder: 1,
          lastOrder: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: parseInt(limit, 10) },
    ]);

    res.json({
      success: true,
      data: customerLTV,
    });
  } catch (error) {
    console.error('Error fetching customer LTV:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Conversion Funnel
export const getConversionFunnel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
    };

    const [totalUsers, ordersStarted, ordersCompleted, paidOrders] = await Promise.all([
      User.countDocuments({ createdAt: match.createdAt }),
      Order.countDocuments(match),
      Order.countDocuments({
        ...match,
        status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
      }),
      Order.countDocuments({
        ...match,
        paymentStatus: 'paid',
      }),
    ]);

    const funnel = [
      { stage: 'Registered Users', count: totalUsers },
      { stage: 'Orders Created', count: ordersStarted },
      { stage: 'Orders Confirmed', count: ordersCompleted },
      { stage: 'Orders Paid', count: paidOrders },
    ];

    const conversionRates = {
      registrationToOrder: totalUsers > 0 ? (ordersStarted / totalUsers) * 100 : 0,
      orderToConfirmed: ordersStarted > 0 ? (ordersCompleted / ordersStarted) * 100 : 0,
      confirmedToPaid: ordersCompleted > 0 ? (paidOrders / ordersCompleted) * 100 : 0,
      overallConversion: totalUsers > 0 ? (paidOrders / totalUsers) * 100 : 0,
    };

    res.json({
      success: true,
      funnel,
      conversionRates,
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error('Error fetching conversion funnel:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Overview Dashboard Stats
export const getOverviewStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = parseDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    const match = {
      createdAt: { $gte: range.start, $lte: range.end },
    };

    const [
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalConsultations,
      averageOrderValue,
    ] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            ...match,
            status: { $nin: ['cancelled', 'refunded'] },
            paymentStatus: 'paid',
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]).then((res) => res[0]?.total || 0),
      Order.countDocuments(match),
      User.countDocuments(match),
      ConsultationRequest.countDocuments(match),
      Order.aggregate([
        {
          $match: {
            ...match,
            status: { $nin: ['cancelled', 'refunded'] },
            paymentStatus: 'paid',
          },
        },
        { $group: { _id: null, avg: { $avg: '$totalAmount' } } },
      ]).then((res) => res[0]?.avg || 0),
    ]);

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrders,
        totalCustomers,
        totalConsultations,
        averageOrderValue,
      },
      range: { start: range.start, end: range.end },
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
