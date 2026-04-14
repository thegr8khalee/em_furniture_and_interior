import LoyaltyTransaction from '../models/loyaltyTransaction.model.js';
import User from '../models/user.model.js';

export const getLoyaltySummary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('loyaltyPoints');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totals = await LoyaltyTransaction.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: '$type',
          points: { $sum: '$points' },
        },
      },
    ]);

    const totalEarned = totals.find((t) => t._id === 'earn')?.points || 0;
    const totalRedeemed = totals.find((t) => t._id === 'redeem')?.points || 0;

    res.json({
      success: true,
      balance: user.loyaltyPoints,
      totalEarned,
      totalRedeemed,
    });
  } catch (error) {
    console.error('Error fetching loyalty summary:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getLoyaltyHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await LoyaltyTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LoyaltyTransaction.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching loyalty history:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
