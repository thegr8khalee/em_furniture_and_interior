import express from 'express';
import { sendContactEmail } from '../controllers/email.controller.js';
import { createLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', createLimiter, sendContactEmail);

export default router;
