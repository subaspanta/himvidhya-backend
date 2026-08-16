const { verifyAccessToken } = require("../config/jwt");
const {
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/responseParser.js");
const User = require("../models/User.model.js");

//  verifies JWT and attaches minimal user info to req.auth
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return unauthorizedResponse(res, "Not authorized");
    }

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }
    if (!user.isActive) {
      return unauthorizedResponse(res, "Account deactivated");
    }

    req.auth = {
      userId: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
    };

    req.user = user;

    next();
  } catch {
    return unauthorizedResponse(res, "Invalid or expired token");
  }
};

// Authorize: simple role check using req.auth
const authorize =
  ({ roles = [] }) =>
  (req, res, next) => {
    if (!req.auth) {
      return forbiddenResponse(res, "Not authenticated");
    }

    if (roles.length && !roles.includes(req.auth.role)) {
      return forbiddenResponse(res, "Insufficient role");
    }

    next();
  };

module.exports = {
  authenticate,
  authorize,
};
