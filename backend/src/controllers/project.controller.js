import Project from '../models/project.model.js';

export const getProjects = async (req, res) => {
  // 1. Get and sanitize pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Ensure parameters are valid positive numbers
  if (page <= 0 || limit <= 0) {
    return res
      .status(400)
      .json({ message: 'Page and limit must be positive numbers.' });
  }

  // Calculate skip value for Mongoose query
  const skip = (page - 1) * limit;

  try {
    // 2. Fetch the total count of documents (for calculating total pages)
    const totalProjects = await Project.countDocuments({});

    // 3. Fetch the projects for the current page
    const projects = await Project.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Optional: sort by creation date descending

    // 4. Calculate pagination metadata
    const totalPages = Math.ceil(totalProjects / limit);

    // 5. Send paginated response
    res.status(200).json({
      data: projects,
      pagination: {
        totalItems: totalProjects,
        limit: limit,
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: 'Projects retrieved successfully.',
    });
  } catch (error) {
    console.error('Error in getProjects controller: ', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProjectsCount = async (req, res) => {
  try {
    const count = await Project.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectById = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
