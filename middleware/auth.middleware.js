const { verifyToken } = require("../config/jwt.js");
const User = require("../models/User.model.js");
const { unauthorizedResponse } = require("../utils/responseParser.js");

const protect = async (req, res, next) => {
  try {
    // Support both cookie and Bearer token
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return unauthorizedResponse(res, "Not authorized - No token provided");
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return unauthorizedResponse(
          res,
          "Session expired - please login again",
        );
      }
      return unauthorizedResponse(res, "Invalid or malformed token");
    }

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Password changed after token issued?
    if (user.passwordChangedAt && decoded.iat) {
      const tokenIssuedAt = new Date(decoded.iat * 1000); // iat is in seconds
      if (user.passwordChangedAt > tokenIssuedAt) {
        return unauthorizedResponse(
          res,
          "Password changed - please login again",
        );
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Authentication failed"
        : error.message;
    return unauthorizedResponse(res, message);
  }
};

module.exports = protect;
