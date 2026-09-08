import { logger } from '../lib/logger.js';
import {
  StaffError,
  deactivateStaff,
  getStaff,
  listStaff,
  staffOptions,
  updateStaff,
} from '../services/staff.js';

/*
 * Operators, for the owner.
 *
 * `req.admin.id` is passed into the service rather than trusted from the body:
 * the "you cannot demote yourself" rule is only worth anything if the actor is
 * the one the session says it is.
 */

const fail = (error, res, where) => {
  if (error instanceof StaffError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

export const getStaffList = async (req, res) => {
  try {
    res.json({
      success: true,
      staff: await listStaff({ includeInactive: req.query.active !== 'true' }),
      ...staffOptions(),
    });
  } catch (error) {
    fail(error, res, 'Error listing operators');
  }
};

export const getOneStaff = async (req, res) => {
  try {
    res.json({ success: true, staff: await getStaff(req.params.staffId) });
  } catch (error) {
    fail(error, res, 'Error loading an operator');
  }
};

export const patchStaff = async (req, res) => {
  try {
    const staff = await updateStaff(req.params.staffId, req.body, req.admin.id);
    res.json({ success: true, staff, message: `${staff.username} updated.` });
  } catch (error) {
    fail(error, res, 'Error updating an operator');
  }
};

export const postStaffDeactivation = async (req, res) => {
  try {
    const staff = await deactivateStaff(req.params.staffId, req.admin.id);
    res.json({
      success: true,
      staff,
      message: `${staff.username} can no longer sign in. Their history is kept.`,
    });
  } catch (error) {
    fail(error, res, 'Error deactivating an operator');
  }
};
