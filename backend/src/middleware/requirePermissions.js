export const requirePermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    const adminPermissions = req.adminPermissions || [];

    const hasAll = requiredPermissions.every((permission) =>
      adminPermissions.includes(permission)
    );

    if (!hasAll) {
      return res.status(403).json({
        message: 'Not authorized: insufficient permissions.',
        requiredPermissions,
      });
    }

    next();
  };
};
