const { z } = require("zod");

// Email validation schema
const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(100, "Email must not exceed 100 characters");

// Password validation schema
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

// Registration schema
const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .trim(),
  email: emailSchema,
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    )
    .optional()
    .or(z.literal("")),
  password: passwordSchema,
});

// Login schema
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Forget password schema
const forgetPasswordSchema = z.object({
  email: emailSchema,
});

// Reset password schema
const resetPasswordSchema = z.object({
  password: passwordSchema,
});

module.exports = {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  passwordSchema,
};
