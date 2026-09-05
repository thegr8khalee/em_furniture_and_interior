import { logger } from '../lib/logger.js';
import {
  ContentError,
  createFaq,
  deleteFaq,
  listFaqs,
  updateFaq,
} from '../services/content.js';

const fail = (error, res, where) => {
  if (error instanceof ContentError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Failed to complete the request.' });
};

export const getFAQs = async (_req, res) => {
  try {
    res.status(200).json(await listFaqs({ activeOnly: true }));
  } catch (error) {
    fail(error, res, 'Error fetching FAQs');
  }
};

export const adminListFAQs = async (_req, res) => {
  try {
    res.status(200).json(await listFaqs({ activeOnly: false }));
  } catch (error) {
    fail(error, res, 'Error fetching admin FAQs');
  }
};

export const createFAQ = async (req, res) => {
  try {
    res.status(201).json(await createFaq(req.body));
  } catch (error) {
    fail(error, res, 'Error creating FAQ');
  }
};

export const updateFAQ = async (req, res) => {
  try {
    res.status(200).json(await updateFaq(req.params.id, req.body));
  } catch (error) {
    fail(error, res, 'Error updating FAQ');
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    if (!(await deleteFaq(req.params.id))) {
      return res.status(404).json({ message: 'FAQ not found.' });
    }
    res.status(200).json({ message: 'FAQ deleted successfully.' });
  } catch (error) {
    fail(error, res, 'Error deleting FAQ');
  }
};
