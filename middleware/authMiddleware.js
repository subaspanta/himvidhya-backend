const { verifyToken } = require("../config/jwt.js");

const protect = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Not authorized" });
    }
    try {
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = protect;
