import express from "express";

import {
  register,
  login,
  logout,
  forgetPassword,
  verifyOTP,
  resetPassword,
  getCurrentUser,
  refreshAccessToken,
} from "../controllers/auth.controller.js";

import {authenticate} from "../middleware/auth.middleware.js";
import {authLimiter, refreshLimiter} from "../middleware/rateLimiter.middleware.js";
import validate from "../middleware/validateRequest.middleware.js";

import {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
} from "../schemas/validationSchemas.js";

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

export default router;
