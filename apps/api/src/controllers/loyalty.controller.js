import { logger } from '../lib/logger.js';
import { EngagementError, loyaltyHistory, loyaltySummary } from '../services/engagement.js';

const fail = (error, res, where) => {
  if (error instanceof EngagementError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const getLoyaltySummary = async (req, res) => {
  try {
    const { totalEarned, totalRedeemed, totalAdjusted } = await loyaltySummary(req.user.id);

    res.json({
      success: true,
      // The balance is the account's; the totals are the ledger's. Publishing
      // both is what makes a disagreement between them visible.
      balance: req.user.loyaltyPoints,
      totalEarned,
      totalRedeemed,
      totalAdjusted,
    });
  } catch (error) {
    fail(error, res, 'Error fetching loyalty summary');
  }
};

export const getLoyaltyHistory = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  try {
    const { transactions, total } = await loyaltyHistory(req.user.id, { page, limit });

    res.json({
      success: true,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error fetching loyalty history');
  }
};
