import express from 'express';
import { calculateTax } from '../controllers/tax.controller.js';
import { identifyGuest } from '../middleware/identifyGuest.js';

const router = express.Router();

// Calculate tax for checkout
router.post('/calculate', identifyGuest, calculateTax);

export default router;
