import express from 'express';
import {
	initializePaystackPayment,
	verifyPaystackPayment,
	uploadBankTransferProof,
} from '../controllers/payments.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { createLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// NOTE: POST /paystack/webhook is deliberately not registered here. Signature
// verification needs the unparsed request body, so it is mounted directly in
// index.js ahead of the body parsers.

// Initialize Paystack payment
router.post('/paystack/initialize', createLimiter, identifyGuest, initializePaystackPayment);

// Verify Paystack payment (public callback after redirect)
router.get('/paystack/verify', verifyPaystackPayment);

// Upload bank transfer proof
router.post('/bank-transfer/proof', createLimiter, identifyGuest, uploadBankTransferProof);

export default router;
