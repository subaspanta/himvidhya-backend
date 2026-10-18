import { z } from "zod";
import { PASSWORD_RULES } from "../config/passwordRules.js";

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

// Matches Class.model.js's own field constraints.
const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Class name is required")
    .max(100, "Class name cannot exceed 100 characters"),
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

// Matches Post.model.js's own field constraints (title 200 chars, content
// 10000 chars) -- anything passing this Zod schema is guaranteed to also
// pass the Mongoose model's constraints.
const postAttachmentInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("file"),
    storageKey: z.string().trim().min(1, "Storage key is required"),
    fileName: z.string().trim().min(1, "File name is required").max(255),
  }),
  z.object({
    type: z.literal("link"),
    url: z
      .string()
      .trim()
      .url("Enter a valid URL")
      .refine((url) => /^https?:\/\//i.test(url), {
        message: "Enter an HTTP or HTTPS URL",
      }),
  }),
  z.object({
    type: z.literal("youtube"),
    url: z
      .string()
      .trim()
      .url("Enter a valid URL")
      .refine((url) => /^https?:\/\//i.test(url), {
        message: "Enter an HTTP or HTTPS URL",
      }),
  }),
]);

const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(10000, "Content cannot exceed 10000 characters"),
  attachments: z.array(postAttachmentInputSchema).max(10).optional(),
});

const updatePostSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    content: z
      .string()
      .trim()
      .min(1, "Content cannot be empty")
      .max(10000, "Content cannot exceed 10000 characters")
      .optional(),
    attachments: z.array(postAttachmentInputSchema).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// Matches Comment.model.js's own field constraint (content 2000 chars) --
// anything passing this Zod schema is guaranteed to also pass the Mongoose
// model's constraint.
const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Comment cannot exceed 2000 characters"),
});

const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(2000, "Comment cannot exceed 2000 characters"),
});

const requestPostAttachmentUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required").max(255),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  size: z.number().int().positive("Size must be a positive number"),
});

const discardPostAttachmentUploadSchema = z.object({
  storageKey: z.string().trim().min(1, "Storage key is required"),
});

// Matches Material.model.js's own field constraints (title 200 chars,
// description 1000 chars) -- anything passing this Zod schema is
// guaranteed to also pass the Mongoose model's constraints. mimeType/size
// are re-validated server-side against the real object (material.service.js
// headObject checks) -- these bounds are a fast client-facing rejection,
// not the enforcement boundary.
const requestMaterialUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  size: z.number().int().positive("Size must be a positive number"),
});

const confirmMaterialUploadSchema = z.object({
  storageKey: z.string().trim().min(1, "Storage key is required"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional(),
  fileName: z.string().trim().min(1, "File name is required"),
});

// storageKey/fileName are only ever populated by the replace flow (a
// client PUTs to the URL from POST /materials/:id/replace-url first, then
// echoes the returned storageKey here) -- material.service.js verifies it
// against the real object via headObject before accepting it, the same way
// confirmMaterialUploadSchema's storageKey is verified.
const updateMaterialSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title cannot exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional(),
    storageKey: z.string().trim().min(1).optional(),
    fileName: z.string().trim().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const requestMaterialReplaceUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  size: z.number().int().positive("Size must be a positive number"),
});

export {
  registerSchema,
  loginSchema,
  forgetPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  emailSchema,
  passwordSchema,
  joinClassSchema,
  createClassSchema,
  updateClassSchema,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
  requestMaterialUploadUrlSchema,
  confirmMaterialUploadSchema,
  updateMaterialSchema,
  requestMaterialReplaceUrlSchema,
  requestPostAttachmentUploadUrlSchema,
  discardPostAttachmentUploadSchema,
};
