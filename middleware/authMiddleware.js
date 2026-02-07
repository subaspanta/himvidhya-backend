const { verifyToken } = require("../config/jwt.js");
const User = require("../models/User.js");
const { unauthorizedResponse } = require("../utils/responseParser.js");

const protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return unauthorizedResponse(res, "Not authorized - No token provided");
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return unauthorizedResponse(res, "Invalid or expired token");
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.passwordChangedAt) {
      if (
        user.passwordChangedAt.getTime() >
        new Date(decoded.passwordChangedAt).getTime()
      ) {
        return unauthorizedResponse(
          res,
          "Password changed, please login again",
        );
      }
    }

    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    const genericError =
      process.env.NODE_ENV === "production"
        ? "Authentication failed"
        : error.message;
    return unauthorizedResponse(res, genericError);
  }
};

module.exports = protect;
