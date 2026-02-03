const express = require("express");
const {
  register,
  login,
  forgetPassword,
  resetPassword,
} = require("../controllers/auth.controller.js");
const protect = require("../middleware/authMiddleware.js");
const { authLimiter } = require("../middleware/rateLimiter.js");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forget-password", authLimiter, forgetPassword);
router.post("/reset-password/:token", authLimiter, resetPassword);
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
