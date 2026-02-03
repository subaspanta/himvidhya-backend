const express = require("express");
const {
  register,
  login,
  forgetPassword,
  resetPassword,
} = require("../controllers/auth.controller.js");
const protect = require("../middleware/authMiddleware.js");
const { authLimiter } = require("../middleware/rateLimiter.js");
const validate = require("../middleware/validateRequest.js");
const {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
} = require("../schemas/validationSchemas.js");

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post(
  "/forget-password",
  authLimiter,
  validate(forgetPasswordSchema),
  forgetPassword,
);
router.post(
  "/reset-password/:token",
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
