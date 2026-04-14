import express from 'express';
import {
  createConsultationRequest,
  getConsultations,
  updateConsultation,
} from '../controllers/consultation.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { trackActivity } from '../middleware/activityTracker.js';

const router = express.Router();

router.post('/', createLimiter, trackActivity('CONSULTATION_SUBMITTED', 'consultation'), createConsultationRequest);

router.get(
  '/admin',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.CONSULTATIONS_MANAGE]),
  getConsultations
);

router.put(
  '/admin/:consultationId',
  protectAdminRoute,
  requirePermissions([PERMISSIONS.CONSULTATIONS_MANAGE]),
  createAuditLog('UPDATE', 'consultation'),
  updateConsultation
);

export default router;
