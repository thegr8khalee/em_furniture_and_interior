import ConsultationRequest from '../models/consultationRequest.model.js';
import Designer from '../models/designer.model.js';
import cloudinary from '../lib/cloudinary.js';

const uploadImage = async (imageData, folder) => {
  if (!imageData || typeof imageData !== 'string') {
    return null;
  }
  if (!imageData.startsWith('data:image')) {
    return null;
  }

  const uploadResponse = await cloudinary.uploader.upload(imageData, {
    folder,
  });

  return {
    url: uploadResponse.secure_url,
    public_id: uploadResponse.public_id,
  };
};
import { sendEmail } from '../services/gmail.service.js';

export const createConsultationRequest = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      budgetMin,
      budgetMax,
      stylePreferences,
      roomPhotos,
      floorPlan,
      preferredDesigner,
      preferredMeetingType,
      notes,
    } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        message: 'Full name, email, and phone are required.',
      });
    }

    let preferredDesignerId = null;
    if (preferredDesigner) {
      const designerExists = await Designer.findById(preferredDesigner);
      if (!designerExists) {
        return res.status(400).json({ message: 'Preferred designer not found.' });
      }
      preferredDesignerId = preferredDesigner;
    }

    const uploadedRoomPhotos = [];
    if (Array.isArray(roomPhotos)) {
      for (const photo of roomPhotos) {
        const upload = await uploadImage(photo, 'consultations/rooms');
        if (upload) uploadedRoomPhotos.push(upload);
      }
    }

    let uploadedFloorPlan = null;
    if (floorPlan) {
      uploadedFloorPlan = await uploadImage(floorPlan, 'consultations/floor_plans');
    }

    const consultation = await ConsultationRequest.create({
      fullName,
      email,
      phone,
      budgetMin: Number(budgetMin) || 0,
      budgetMax: Number(budgetMax) || 0,
      stylePreferences: Array.isArray(stylePreferences) ? stylePreferences : [],
      roomPhotos: uploadedRoomPhotos,
      floorPlan: uploadedFloorPlan,
      preferredDesigner: preferredDesignerId,
      preferredMeetingType: preferredMeetingType || 'calendly',
      notes: notes || '',
    });

    const adminEmail = process.env.EMAIL_USER || 'emfurnitureandinterior@gmail.com';

    await sendEmail({
      to: adminEmail,
      subject: 'New consultation request received',
      text: `New consultation request from ${fullName} (${email}).
Phone: ${phone}
Budget: ${budgetMin || 0} - ${budgetMax || 0}
Meeting: ${preferredMeetingType || 'calendly'}`,
      html: `
        <h3>New consultation request</h3>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Budget:</strong> ${budgetMin || 0} - ${budgetMax || 0}</p>
        <p><strong>Meeting:</strong> ${preferredMeetingType || 'calendly'}</p>
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

    res.status(201).json({
      message: 'Consultation request submitted successfully.',
      consultation,
    });
  } catch (error) {
    console.error('Error creating consultation request:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getConsultations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }

    const consultations = await ConsultationRequest.find(query)
      .populate('preferredDesigner', 'name title')
      .populate('assignedDesigner', 'name title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ConsultationRequest.countDocuments(query);

    res.status(200).json({
      consultations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching consultations:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const {
      status,
      assignedDesigner,
      meetingLink,
      scheduledAt,
      adminNotes,
    } = req.body;

    const consultation = await ConsultationRequest.findById(consultationId);
    if (!consultation) {
      return res.status(404).json({ message: 'Consultation not found.' });
    }

    if (status) consultation.status = status;
    if (meetingLink !== undefined) consultation.meetingLink = meetingLink;
    if (adminNotes !== undefined) consultation.adminNotes = adminNotes;

    if (scheduledAt) {
      consultation.scheduledAt = new Date(scheduledAt);
    }

    if (assignedDesigner) {
      const designerExists = await Designer.findById(assignedDesigner);
      if (!designerExists) {
        return res.status(400).json({ message: 'Assigned designer not found.' });
      }
      consultation.assignedDesigner = assignedDesigner;
    }

    await consultation.save();

    res.status(200).json({ consultation });
  } catch (error) {
    console.error('Error updating consultation:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
