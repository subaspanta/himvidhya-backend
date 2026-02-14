const {
  canCreateClass,
  canJoinClass,
  canViewClassDetails,
  canSendMessageInChannel,
} = require("../permissions/rules");

const requirePermission = (permissionFn) => {
  return (req, res, next) => {
    // You can pass extra context from req (e.g. classDoc for view details)
    const context = {
      // Example: if viewing class, attach classDoc if already fetched
      classDoc: req.classDoc, // you can attach this in a previous middleware
      channel: req.body?.channel || req.query?.channel,
      // add more context as needed
    };

    const hasPermission = permissionFn(req.user, context);

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
