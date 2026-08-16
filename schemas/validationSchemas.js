const { z } = require("zod");
const { PASSWORD_RULES } = require("../config/passwordRules.js");

const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(100, "Email must not exceed 100 characters");

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

const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .trim(),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["student", "teacher"], {
    required_error: "Role is required",
    invalid_type_error: "Role must be either student or teacher",
  }),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const forgetPasswordSchema = z.object({
  email: emailSchema,
});

const verifyOTPSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers"),
});

const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers"),
  password: passwordSchema,
});

const joinClassSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be at least 6 characters")
    .max(10, "Code cannot exceed 10 characters")
    .trim(),
});

// Matches Class.model.js's own field constraints. All fields optional —
// a PATCH may touch any subset — but at least one must be present, or
// there is nothing to update.
const updateClassSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Class name cannot be empty")
      .max(100, "Class name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional(),
    subject: z
      .string()
      .trim()
      .max(100, "Subject cannot exceed 100 characters")
      .optional(),
    college: z.string().trim().optional(),
    semester: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

module.exports = {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  emailSchema,
  passwordSchema,
  joinClassSchema,
  updateClassSchema,
};
