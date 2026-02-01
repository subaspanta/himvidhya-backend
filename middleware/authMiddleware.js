const { verifyToken } = require("../config/jwt.js");

const protect = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Not authorized" });
    }
    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }
      // Fetch user and check passwordChangedAt
      const User = require("../models/User.js");
      User.findById(decoded.userId)
        .then((user) => {
          if (!user) {
            return res
              .status(401)
              .json({ success: false, error: "User not found" });
          }
          if (user.passwordChangedAt && decoded.passwordChangedAt) {
            if (
              user.passwordChangedAt.getTime() >
              new Date(decoded.passwordChangedAt).getTime()
            ) {
              return res
                .status(401)
                .json({
                  success: false,
                  error: "Password changed, please login again",
                });
            }
          }
          req.userId = decoded.userId;
          next();
        })
        .catch(() => {
          return res
            .status(401)
            .json({ success: false, error: "User lookup failed" });
        });
    } catch (error) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = protect;
