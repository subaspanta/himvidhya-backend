import { verifyToken } from "../config/jwt.js";

export const protect = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: "Not authorized" });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};

export default protect;
