import { logger } from '../lib/logger.js';
import {
  InteriorsError,
  createDesigner as createDesignerRow,
  listDesigners,
  removeDesigner,
  updateDesigner as updateDesignerRow,
} from '../services/interiors.js';

const fail = (error, res, where) => {
  if (error instanceof InteriorsError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const getActiveDesigners = async (_req, res) => {
  try {
    res.status(200).json({ designers: await listDesigners({ activeOnly: true }) });
  } catch (error) {
    fail(error, res, 'Error fetching designers');
  }
};

export const getAllDesigners = async (_req, res) => {
  try {
    res.status(200).json({ designers: await listDesigners() });
  } catch (error) {
    fail(error, res, 'Error fetching designers');
  }
};

export const createDesigner = async (req, res) => {
  try {
    res.status(201).json({ designer: await createDesignerRow(req.body) });
  } catch (error) {
    fail(error, res, 'Error creating designer');
  }
};

export const updateDesigner = async (req, res) => {
  try {
    const designer = await updateDesignerRow(req.params.designerId, req.body);
    res.status(200).json({ designer });
  } catch (error) {
    fail(error, res, 'Error updating designer');
  }
};

/**
 * Retires a designer.
 *
 * One who has taken consultations is deactivated rather than deleted: removing
 * the row would take their name off every consultation they ran, and a history
 * that says "unassigned" is not a history.
 */
export const deleteDesigner = async (req, res) => {
  try {
    const { removed, deactivated, designer } = await removeDesigner(req.params.designerId);

    if (!removed) {
      return res.status(404).json({ message: 'Designer not found.' });
    }

    res.status(200).json({
      message: deactivated
        ? 'Designer deactivated — they are named on past consultations, so the record is kept.'
        : 'Designer deleted successfully.',
      ...(designer ? { designer } : {}),
    });
  } catch (error) {
    fail(error, res, 'Error deleting designer');
  }
};
