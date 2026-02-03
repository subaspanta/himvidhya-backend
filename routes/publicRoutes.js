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

// Password requirements endpoint
router.get("/password-requirements", (req, res) => {
  res.json({
    success: true,
    requirements: {
      minLength: 8,
      mustInclude: {
        uppercase: "At least one uppercase letter (A-Z)",
        number: "At least one number (0-9)",
        symbol: "At least one special character (!@#$%^&*)",
      },
      description: "Password must meet all requirements above",
    },
  });
});

router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
