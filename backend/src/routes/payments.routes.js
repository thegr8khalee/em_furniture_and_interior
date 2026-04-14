import express from 'express';
import {
	initializePaystackPayment,
	verifyPaystackPayment,
	initializeFlutterwavePayment,
	verifyFlutterwavePayment,
	initializeStripePayment,
	verifyStripePayment,
	uploadBankTransferProof,
} from '../controllers/payments.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { createLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Initialize Paystack payment
router.post('/paystack/initialize', createLimiter, identifyGuest, initializePaystackPayment);

// Verify Paystack payment (public callback)
router.get('/paystack/verify', verifyPaystackPayment);

// Initialize Flutterwave payment
router.post('/flutterwave/initialize', createLimiter, identifyGuest, initializeFlutterwavePayment);

// Verify Flutterwave payment (public callback)
router.get('/flutterwave/verify', verifyFlutterwavePayment);

// Initialize Stripe payment
router.post('/stripe/initialize', createLimiter, identifyGuest, initializeStripePayment);

// Verify Stripe payment (public callback)
router.get('/stripe/verify', verifyStripePayment);

// Upload bank transfer proof
router.post('/bank-transfer/proof', createLimiter, identifyGuest, uploadBankTransferProof);

export default router;
