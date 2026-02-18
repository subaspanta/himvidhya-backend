const { verifyAccessToken } = require("../config/jwt");
const User = require("../models/User.model.js");
const { unauthorizedResponse } = require("../utils/responseParser.js");

const protect = async (req, res, next) => {
  try {
    // Prefer httpOnly cookie
    let token = req.cookies?.accessToken;

    // Optional: support Bearer token for Postman / testing
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    console.log("[AUTH DEBUG] Token found:", token ? "YES" : "NO");
    console.log(
      "[AUTH DEBUG] Cookie token:",
      req.cookies?.accessToken ? "EXISTS" : "MISSING",
    );
    console.log(
      "[AUTH DEBUG] Auth header:",
      req.headers.authorization ? "EXISTS" : "MISSING",
    );

    if (!token) {
      return unauthorizedResponse(res, "Not authorized - no access token");
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
      console.log(
        "[AUTH DEBUG] Token verified successfully for user:",
        decoded.userId,
      );
    } catch (jwtError) {
      console.error("[AUTH DEBUG] JWT verification failed:", jwtError.message);
      console.error("[AUTH DEBUG] JWT error name:", jwtError.name);
      if (jwtError.name === "TokenExpiredError") {
        return unauthorizedResponse(res, "Access token expired");
      }
      return unauthorizedResponse(res, "Invalid access token");
    }

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    // Invalidate token if password changed after token was issued
    if (user.passwordChangedAt && decoded.iat) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
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
    console.error("[AUTH] protect error:", error);
    return unauthorizedResponse(res, "Authentication failed");
  }
};

module.exports = protect;
