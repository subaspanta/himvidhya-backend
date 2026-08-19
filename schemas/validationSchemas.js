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

// Attachment shapes the composer can submit alongside a post. File
// attachments only carry the storageKey issued by
// requestPostAttachmentUploadUrlService -- mimeType/size are re-derived
// server-side from the real object (post.service.js's verifyUploadedObject
// check). Max 10 mirrors the I5-style caps already used elsewhere in this
// schema file (e.g. pinned posts).
const MAX_POST_ATTACHMENTS = 10;

const postFileAttachmentSchema = z.object({
  type: z.literal("file"),
  storageKey: z.string().trim().min(1, "Storage key is required"),
  fileName: z.string().trim().min(1, "File name is required"),
});

// z.string().url() only checks that `new URL()` doesn't throw -- it accepts
// any scheme, including javascript:. Since these URLs are later rendered as
// a raw href client-side (PostAttachments.tsx), an unrestricted scheme is a
// stored-XSS vector. Restrict to http(s) here, the actual boundary.
const httpUrlSchema = z
  .string()
  .trim()
  .url("Invalid URL")
  .refine((url) => /^https?:\/\//i.test(url), "URL must start with http:// or https://");

const postLinkAttachmentSchema = z.object({
  type: z.literal("link"),
  url: httpUrlSchema,
});

const postYoutubeAttachmentSchema = z.object({
  type: z.literal("youtube"),
  url: httpUrlSchema,
});

const postAttachmentInputSchema = z.discriminatedUnion("type", [
  postFileAttachmentSchema,
  postLinkAttachmentSchema,
  postYoutubeAttachmentSchema,
]);

const postAttachmentsSchema = z
  .array(postAttachmentInputSchema)
  .max(MAX_POST_ATTACHMENTS, `Cannot attach more than ${MAX_POST_ATTACHMENTS} items`)
  .optional();

// Matches Post.model.js's own field constraints (title 200 chars, content
// 10000 chars) -- anything passing this Zod schema is guaranteed to also
// pass the Mongoose model's constraints.
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
  attachments: postAttachmentsSchema,
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
    attachments: postAttachmentsSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// Declared-value fast-reject; server-side headObject re-verification
// happens downstream in post.service.js's verifyUploadedObject.
const requestPostAttachmentUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  size: z.number().int().positive("Size must be a positive number"),
});

// Composer-side discard: a file already PUT to storage but never attached
// to a saved post (removed before submit, or the draft was abandoned).
const discardPostAttachmentUploadSchema = z.object({
  storageKey: z.string().trim().min(1, "Storage key is required"),
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
  createPostSchema,
  updatePostSchema,
  requestPostAttachmentUploadUrlSchema,
  discardPostAttachmentUploadSchema,
  createCommentSchema,
  updateCommentSchema,
};
