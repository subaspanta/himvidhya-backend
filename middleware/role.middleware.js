const requirePermission = (permissionFn) => {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const context = {
      classDoc: req.classDoc,
      channel: req.body?.channel || req.query?.channel,
    };

    const hasPermission = permissionFn(req.auth, context);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
};

module.exports = requirePermission;
