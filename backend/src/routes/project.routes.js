import express from 'express';
import { getProjectById, getProjects, getProjectsCount } from '../controllers/project.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', searchLimiter, getProjects);
router.get('/count', getProjectsCount);
router.get('/get/:projectId', getProjectById);

export default router;
