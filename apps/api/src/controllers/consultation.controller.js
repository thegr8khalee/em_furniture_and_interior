import { sendEmail } from '../services/gmail.service.js';
import { logger } from '../lib/logger.js';
import {
  InteriorsError,
  listConsultations,
  requestConsultation,
  updateConsultation as updateConsultationRow,
  billConsultation,
  payConsultationFee,
} from '../services/interiors.js';

/*
 * Consultation requests. The uploads, the designer checks and the states the
 * database will accept are in services/interiors.js.
 */

const fail = (error, res, where) => {
  if (error instanceof InteriorsError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Internal Server Error' });
};

/**
 * Tells the studio, and the person who asked.
 *
 * After the request is stored and never able to fail it: a mail server that is
 * down must not lose an enquiry the shop has already recorded.
 */
const announce = async (consultation) => {
  const adminEmail = process.env.EMAIL_USER || 'emfurnitureandinterior@gmail.com';
  const { fullName, email, phone, budgetMin, budgetMax, preferredMeetingType } = consultation;

  try {
    await sendEmail({
      to: adminEmail,
      subject: 'New consultation request received',
      text: `New consultation request from ${fullName} (${email}).
Phone: ${phone}
Budget: ${budgetMin} - ${budgetMax}
Meeting: ${preferredMeetingType}`,
      html: `
        <h3>New consultation request</h3>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Budget:</strong> ${budgetMin} - ${budgetMax}</p>
        <p><strong>Meeting:</strong> ${preferredMeetingType}</p>
      `,
      from: `"${fullName}" <${adminEmail}>`,
    });

    await sendEmail({
      to: email,
      subject: 'Your consultation request was received',
      text: `Hi ${fullName},\n\nWe received your consultation request. Our team will reach out shortly to confirm the details.\n\nThank you,\nEM Furniture & Interior`,
      html: `
        <p>Hi ${fullName},</p>
        <p>We received your consultation request. Our team will reach out shortly to confirm the details.</p>
        <p>Thank you,<br/>EM Furniture & Interior</p>
      `,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send consultation emails');
  }
};

export const createConsultationRequest = async (req, res) => {
  try {
    // A signed-in enquirer is linked to their account; most are not signed in,
    // which is why the contact details are on the request itself.
    const consultation = await requestConsultation(req.body, req.user?.id ?? null);

    await announce(consultation);

    res.status(201).json({
      message: 'Consultation request submitted successfully.',
      consultation,
    });
  } catch (error) {
    fail(error, res, 'Error creating consultation request');
  }
};

export const getConsultations = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  try {
    const { consultations, total } = await listConsultations({
      page,
      limit,
      status: req.query.status || null,
    });

    res.status(200).json({
      consultations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error fetching consultations');
  }
};

export const updateConsultation = async (req, res) => {
  try {
    const consultation = await updateConsultationRow(req.params.consultationId, req.body);
    res.status(200).json({ consultation });
  } catch (error) {
    fail(error, res, 'Error updating consultation');
  }
};

/**
 * Bills a consultation for the design work.
 *
 * The moment the fee becomes owed, and the moment `4200` first hears about the
 * design half of the business.
 */
export const postConsultationBill = async (req, res) => {
  try {
    const consultation = await billConsultation(req.params.consultationId, {
      amount: req.body?.amount,
      tax: req.body?.tax ?? 0,
      staffId: req.admin?.id ?? null,
    });

    res.json({
      success: true,
      consultation,
      message: `Billed ₦${consultation.fee.total.toLocaleString()} for design work.`,
    });
  } catch (error) {
    fail(error, res, 'Error billing a consultation');
  }
};

export const postConsultationFeePayment = async (req, res) => {
  try {
    const consultation = await payConsultationFee(req.params.consultationId, {
      paymentMethod: req.body?.paymentMethod,
      paidOn: req.body?.paidOn || null,
    });

    res.json({ success: true, consultation, message: 'Design fee settled.' });
  } catch (error) {
    fail(error, res, 'Error settling a design fee');
  }
};
