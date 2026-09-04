import LoyaltyTransaction from '../models/loyaltyTransaction.model.js';
import { logger } from '../lib/logger.js';

export const getLoyaltySummary = async (req, res) => {
  try {
    // The balance is a column on the account, which `protectRoute` has already
    // read; the second lookup it used to do here answered the same question
    // twice. The transaction ledger has not moved yet, so the totals below are
    // still a Mongo aggregate keyed on the account's UUID.
    const userId = req.user.id;

    const totals = await LoyaltyTransaction.aggregate([
      { $match: { user: userId } },
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
      balance: req.user.loyaltyPoints,
      totalEarned,
      totalRedeemed,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching loyalty summary');
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
    logger.error({ err: error }, 'Error fetching loyalty history');
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
