import express from 'express';
import { getBlogPostBySlug, getBlogPosts } from '../controllers/blog.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', searchLimiter, getBlogPosts);
router.get('/:slug', getBlogPostBySlug);

export default router;
