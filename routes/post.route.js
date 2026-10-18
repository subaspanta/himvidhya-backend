// Split routers keep class-scoped and top-level post paths separate.
// The nested router uses mergeParams to read classId from its mount path.
import express from "express";

const classScopedPostRoutes = express.Router({ mergeParams: true });
const postRoutes = express.Router();

import {
  createPostController,
  listPostsController,
  getPostByIdController,
  updatePostController,
  deletePostController,
  pinPostController,
  unpinPostController,
  requestPostAttachmentUploadUrlController,
  discardPostAttachmentUploadController,
  getPostAttachmentDownloadUrlController,
} from "../controllers/post.controller.js";

import { authenticate, authorize } from "../middleware/auth.middleware.js";
import validate from "../middleware/validateRequest.middleware.js";
import {
  writeLimiter,
  uploadLimiter,
} from "../middleware/rateLimiter.middleware.js";
import {
  createPostSchema,
  updatePostSchema,
  requestPostAttachmentUploadUrlSchema,
  discardPostAttachmentUploadSchema,
} from "../schemas/validationSchemas.js";

// Mounted at /classes/:classId/posts.
classScopedPostRoutes.post(
  "/attachment-upload-url",
  authenticate,
  authorize({ roles: ["teacher"] }),
  uploadLimiter,
  validate(requestPostAttachmentUploadUrlSchema),
  requestPostAttachmentUploadUrlController,
);
classScopedPostRoutes.delete(
  "/attachment-upload-url",
  authenticate,
  authorize({ roles: ["teacher"] }),
  validate(discardPostAttachmentUploadSchema),
  discardPostAttachmentUploadController,
);
classScopedPostRoutes.post(
  "/",
  authenticate,
  authorize({ roles: ["teacher"] }),
  writeLimiter,
  validate(createPostSchema),
  createPostController,
);
classScopedPostRoutes.get("/", authenticate, listPostsController);

// Mounted at /posts.
postRoutes.get("/:postId", authenticate, getPostByIdController);
postRoutes.patch(
  "/:postId",
  authenticate,
  authorize({ roles: ["teacher"] }),
  validate(updatePostSchema),
  updatePostController,
);
postRoutes.delete(
  "/:postId",
  authenticate,
  authorize({ roles: ["teacher"] }),
  deletePostController,
);
postRoutes.post(
  "/:postId/pin",
  authenticate,
  authorize({ roles: ["teacher"] }),
  pinPostController,
);
postRoutes.delete(
  "/:postId/pin",
  authenticate,
  authorize({ roles: ["teacher"] }),
  unpinPostController,
);
postRoutes.get(
  "/:postId/attachments/:attachmentId/download-url",
  authenticate,
  getPostAttachmentDownloadUrlController,
);

export { classScopedPostRoutes, postRoutes };
