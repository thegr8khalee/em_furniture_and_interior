import { logger } from '../lib/logger.js';
import {
  CustomerError,
  adjustLoyalty,
  customerAddresses,
  customerSummary,
  getCustomer,
  listCustomers,
} from '../services/customers.js';

/*
 * The customer book, for the console.
 *
 * Read-only but for one action, because a customer's own details belong to the
 * customer: an operator who could edit a name and an email could quietly become
 * somebody. The exception is a loyalty adjustment, which is an operator's
 * decision and is recorded as a movement with a reason.
 */

const fail = (error, res, where) => {
  if (error instanceof CustomerError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getCustomers = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

  try {
    const { customers, total } = await listCustomers({
      page,
      limit,
      search: req.query.search || null,
      sort: req.query.sort || 'recent',
      withOrdersOnly: req.query.buyersOnly === 'true',
    });

    res.json({
      success: true,
      customers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error listing customers');
  }
};

export const getCustomerStats = async (req, res) => {
  try {
    res.json({ success: true, stats: await customerSummary() });
  } catch (error) {
    fail(error, res, 'Error summarising customers');
  }
};

export const getOneCustomer = async (req, res) => {
  try {
    res.json({ success: true, ...(await getCustomer(req.params.customerId)) });
  } catch (error) {
    fail(error, res, 'Error loading a customer');
  }
};

export const getCustomerAddresses = async (req, res) => {
  try {
    res.json({ success: true, addresses: await customerAddresses(req.params.customerId) });
  } catch (error) {
    fail(error, res, 'Error loading addresses');
  }
};

export const postLoyaltyAdjustment = async (req, res) => {
  try {
    const result = await adjustLoyalty(req.params.customerId, {
      points: req.body?.points,
      reason: req.body?.reason,
    });

    res.json({ success: true, ...result, message: `Balance is now ${result.points} points.` });
  } catch (error) {
    fail(error, res, 'Error adjusting loyalty points');
  }
};
