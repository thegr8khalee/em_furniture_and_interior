import { logger } from '../lib/logger.js';
import { ContentError, countProjects, getProject, listProjects } from '../services/content.js';

/*
 * Portfolio projects, for the storefront. The console's create, update and
 * delete are in admin.controller.js, alongside the catalog's.
 */

const fail = (error, res, where) => {
  if (error instanceof ContentError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const getProjects = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  if (page <= 0 || limit <= 0) {
    return res.status(400).json({ message: 'Page and limit must be positive numbers.' });
  }

  try {
    const { projects, total } = await listProjects({
      page,
      limit: Math.min(limit, 100),
      category: req.query.category || null,
      search: req.query.search || null,
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      data: projects,
      pagination: {
        totalItems: total,
        limit,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: 'Projects retrieved successfully.',
    });
  } catch (error) {
    fail(error, res, 'Error in getProjects controller');
  }
};

export const getProjectsCount = async (_req, res) => {
  try {
    res.json({ count: await countProjects() });
  } catch (error) {
    fail(error, res, 'Error in getProjectsCount controller');
  }
};

export const getProjectById = async (req, res) => {
  try {
    res.status(200).json(await getProject(req.params.id ?? req.params.projectId));
  } catch (error) {
    fail(error, res, 'Error in getProjectById controller');
  }
};
