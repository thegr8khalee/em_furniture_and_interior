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
import {
	handlePaystackWebhook,
	handleFlutterwaveWebhook,
	handleStripeWebhook,
} from '../controllers/webhooks.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';
import { createLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// --- Gateway webhooks ------------------------------------------------------
// Authoritative source of payment state. Mounted before the customer-facing
// routes and deliberately NOT rate-limited: throttling a gateway just makes it
// retry, and the signature check already rejects anything unauthenticated.
// The raw body these need is preserved by the express.raw() mount in index.js.
router.post('/webhooks/paystack', handlePaystackWebhook);
router.post('/webhooks/flutterwave', handleFlutterwaveWebhook);
router.post('/webhooks/stripe', handleStripeWebhook);

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
