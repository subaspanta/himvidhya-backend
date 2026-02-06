const { verifyToken } = require("../config/jwt.js");
const User = require("../models/User.js");

const protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: "Authentication failed: Invalid token" });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.passwordChangedAt) {
      if (
        user.passwordChangedAt.getTime() >
        new Date(decoded.passwordChangedAt).getTime()
      ) {
        return res.status(401).json({
          success: false,
          error: "Password changed, please login again",
        });
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
    return res.status(401).json({
      success: false,
      error: genericError,
    });
  }
};

module.exports = protect;
