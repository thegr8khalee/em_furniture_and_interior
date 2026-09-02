import FAQ from '../models/faq.model.js';
import { logger } from '../lib/logger.js';

export const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.status(200).json(faqs);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching FAQs');
    res.status(500).json({ message: 'Failed to fetch FAQs.' });
  }
};

export const adminListFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({}).sort({ order: 1, createdAt: 1 }).lean();
    res.status(200).json(faqs);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin FAQs');
    res.status(500).json({ message: 'Failed to fetch FAQs.' });
  }
};

export const createFAQ = async (req, res) => {
  try {
    const { question, answer, order, isActive } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ message: 'Question and answer are required.' });
    }

    const faq = await FAQ.create({
      question,
      answer,
      order: typeof order === 'number' ? order : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    res.status(201).json(faq);
  } catch (error) {
    logger.error({ err: error }, 'Error creating FAQ');
    res.status(500).json({ message: 'Failed to create FAQ.' });
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, order, isActive } = req.body;

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found.' });
    }

    if (question !== undefined) faq.question = question;
    if (answer !== undefined) faq.answer = answer;
    if (order !== undefined) faq.order = order;
    if (isActive !== undefined) faq.isActive = isActive;

    await faq.save();

    res.status(200).json(faq);
  } catch (error) {
    logger.error({ err: error }, 'Error updating FAQ');
    res.status(500).json({ message: 'Failed to update FAQ.' });
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByIdAndDelete(id);

    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found.' });
    }

    res.status(200).json({ message: 'FAQ deleted successfully.' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting FAQ');
    res.status(500).json({ message: 'Failed to delete FAQ.' });
  }
};
