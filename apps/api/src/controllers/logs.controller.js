import { logger } from '../lib/logger.js';
import {
  activityStats,
  auditStats,
  listActivityLogs,
  listAuditLogs,
  purgeAuditLogs,
} from '../services/logs.js';

/*
 * Reading the two logs. Writing them is in the middleware; the queries are in
 * services/logs.js.
 */

const fail = (res, error, message) => {
  logger.error({ err: error }, message);
  return res.status(500).json({ message });
};

const paginate = (req) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200),
});

const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

// Get audit logs with filtering and pagination
export const getAuditLogs = async (req, res) => {
  const { page, limit } = paginate(req);

  try {
    const { logs, total } = await listAuditLogs({
      page,
      limit,
      action: req.query.action,
      resourceType: req.query.resourceType,
      actor: req.query.actor,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    res.json({ success: true, data: logs, pagination: pagination(page, limit, total) });
  } catch (error) {
    fail(res, error, 'Failed to fetch audit logs');
  }
};

export const getAuditLogStats = async (req, res) => {
  try {
    const stats = await auditStats({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, stats });
  } catch (error) {
    fail(res, error, 'Failed to fetch audit log statistics');
  }
};

// Get activity logs with filtering and pagination
export const getActivityLogs = async (req, res) => {
  const { page, limit } = paginate(req);

  try {
    const { logs, total } = await listActivityLogs({
      page,
      limit,
      activityType: req.query.activityType,
      resourceType: req.query.resourceType,
      userId: req.query.userId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    res.json({ success: true, data: logs, pagination: pagination(page, limit, total) });
  } catch (error) {
    fail(res, error, 'Failed to fetch activity logs');
  }
};

export const getActivityLogStats = async (req, res) => {
  try {
    const stats = await activityStats({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, stats });
  } catch (error) {
    fail(res, error, 'Failed to fetch activity log statistics');
  }
};

// Delete old audit logs (admin only)
export const cleanupAuditLogs = async (req, res) => {
  try {
    const { deletedCount, days } = await purgeAuditLogs(req.body?.daysToKeep ?? 90);

    if (days === null) {
      return res.status(400).json({ message: 'daysToKeep must be a whole number of days.' });
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount} audit log entries older than ${days} days`,
      deletedCount,
    });
  } catch (error) {
    fail(res, error, 'Failed to cleanup audit logs');
  }
};
