import express from 'express';
import {
  createConsultationRequest,
  getConsultations,
  updateConsultation,
} from '../controllers/consultation.controller.js';
import { protectAdminRoute } from '../middleware/protectAdminRoute.js';
import { requirePermissions } from '../middleware/requirePermissions.js';
import { PERMISSIONS } from '@em/shared/permissions';
import { createLimiter } from '../middleware/rateLimiter.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { trackActivity } from '../middleware/activityTracker.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

// identifyGuest so a signed-in enquirer's request is linked to their account,
// and so the activity tracker has somebody to attribute the visit to. Without
// it `req.user` was never set here and every consultation looked anonymous.
router.post(
  '/',
  createLimiter,
  identifyGuest,
  trackActivity('CONSULTATION_SUBMITTED', 'consultation'),
  createConsultationRequest
);

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
