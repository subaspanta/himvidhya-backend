const { verifyAccessToken } = require("../config/jwt");
const {
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/responseParser.js");
const User = require("../models/User.model.js");

// Authenticate: verifies JWT and attaches minimal user info to req.auth
const authenticate = (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) return unauthorizedResponse(res, "Not authorized");

    const decoded = verifyAccessToken(token);
    req.auth = {
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };
    next();
  } catch (error) {
    return unauthorizedResponse(res, "Invalid or expired token");
  }
};

// AttachUser: fetches full user from DB and attaches to req.user
const attachUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select("-passwordHash");
    if (!user) return unauthorizedResponse(res, "User not found");
    req.user = user;
    next();
  } catch (error) {
    return unauthorizedResponse(res, "Failed to fetch user");
  }
};

// Authorize: checks roles and permissions
const authorize =
  ({ roles = [], permissions = [] }) =>
  (req, res, next) => {
    const user = req.auth;

    // Role check
    if (roles.length && !roles.includes(user.role)) {
      return forbiddenResponse(res, "Insufficient role");
    }

    // Permission check
    if (
      permissions.length &&
      !permissions.every((p) => user.permissions.includes(p))
    ) {
      return forbiddenResponse(res, "Insufficient permissions");
    }

    next();
  };

module.exports = {
  authenticate,
  attachUser,
  authorize,
};
