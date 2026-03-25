const express = require("express");
const {
  register,
  login,
  logout,
  forgetPassword,
  verifyOTP,
  resetPassword,
  getCurrentUser,
  refreshAccessToken,
} = require("../controllers/auth.controller.js");
const { authenticate } = require("../middleware/auth.middleware.js");
const {
  authLimiter,
  refreshLimiter,
} = require("../middleware/rateLimiter.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
} = require("../schemas/validationSchemas.js");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh-token", refreshLimiter, refreshAccessToken);
router.post("/logout", authenticate, logout);
router.post(
  "/forget-password",
  authLimiter,
  validate(forgetPasswordSchema),
  forgetPassword,
);
router.post("/verify-otp", authLimiter, validate(verifyOTPSchema), verifyOTP);
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

router.get("/me", authenticate, getCurrentUser);

module.exports = router;
