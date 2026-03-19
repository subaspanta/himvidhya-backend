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
const {
  authenticate,
  attachUser,
} = require("../middleware/auth.middleware.js");
const { authLimiter } = require("../middleware/rateLimiter.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
} = require("../schemas/validationSchemas.js");

const { successResponse } = require("../utils/responseParser.js");
const { getPasswordRequirements } = require("../config/passwordRules.js");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh-token", refreshAccessToken);
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

// Get current authenticated user
router.get("/me", authenticate, attachUser, getCurrentUser);

module.exports = router;
