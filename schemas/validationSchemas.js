const { z } = require("zod");
const { PASSWORD_RULES } = require("../config/passwordRules.js");

// Email validation schema
const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(100, "Email must not exceed 100 characters");

// Password validation schema
const passwordSchema = z
  .string()
  .min(
    PASSWORD_RULES.minLength,
    `Password must be at least ${PASSWORD_RULES.minLength} characters`,
  )
  .regex(
    PASSWORD_RULES.mustInclude.uppercase.regex,
    PASSWORD_RULES.mustInclude.uppercase.message,
  )
  .regex(
    PASSWORD_RULES.mustInclude.number.regex,
    PASSWORD_RULES.mustInclude.number.message,
  )
  .regex(
    PASSWORD_RULES.mustInclude.symbol.regex,
    PASSWORD_RULES.mustInclude.symbol.message,
  );

// Registration schema
const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .trim(),
  email: emailSchema,
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

// Verify OTP schema
const verifyOTPSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers"),
});

// Reset password schema
const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers"),
  password: passwordSchema,
});

module.exports = {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  emailSchema,
  passwordSchema,
};
