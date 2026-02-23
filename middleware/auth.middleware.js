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
    if (!token) {
      console.log("[AUTH] No access token found in cookies");
      return unauthorizedResponse(res, "Not authorized");
    }

    const decoded = verifyAccessToken(token);
    // Fetch full user from DB
    User.findById(decoded.userId)
      .select("-passwordHash")
      .then((user) => {
        if (!user) {
          console.log(
            "[AUTH] User not found for decoded.userId:",
            decoded.userId,
          );
          req.auth = undefined;
          return unauthorizedResponse(res, "User not found");
        }
        req.auth = {
          userId: user._id,
          role: user.role,
          permissions: user.permissions || [],
          name: user.name,
          email: user.email,
        };
        console.log("[AUTH] Authenticated user:", req.auth);
        next();
      })
      .catch((err) => {
        console.log("[AUTH] Error fetching user:", err);
        req.auth = undefined;
        return unauthorizedResponse(res, "Failed to fetch user");
      });
  } catch (error) {
    console.log("[AUTH] Invalid or expired token:", error);
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
    console.log("[AUTHORIZE] Checking user:", user);
    console.log(
      "[AUTHORIZE] Required roles:",
      roles,
      "Required permissions:",
      permissions,
    );

    // Role check
    if (roles.length && !roles.includes(user.role)) {
      console.log("[AUTHORIZE] User role insufficient:", user.role);
      return forbiddenResponse(res, "Insufficient role");
    }

    // Permission check
    if (
      permissions.length &&
      !permissions.every((p) => user.permissions.includes(p))
    ) {
      console.log("[AUTHORIZE] User permissions:", user.permissions);
      console.log("[AUTHORIZE] User lacks required permissions");
      return forbiddenResponse(res, "Insufficient permissions");
    }

    next();
  };

module.exports = {
  authenticate,
  attachUser,
  authorize,
};
