import express from 'express';
import { getFAQs } from '../controllers/faq.controller.js';

const router = express.Router();

router.get('/', getFAQs);

export default router;
