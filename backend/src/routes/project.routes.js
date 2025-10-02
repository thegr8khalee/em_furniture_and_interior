import express from 'express';
import { getProjectById, getProjects, getProjectsCount } from '../controllers/project.controller.js';

const router = express.Router();

router.get('/', getProjects);
router.get('/count', getProjectsCount);
router.get('/get/:projectId', getProjectById);

export default router;
