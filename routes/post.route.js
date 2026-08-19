// Posts is the first feature needing two genuinely different path prefixes
// for one resource: class-scoped (create/list, nested under
// /classes/:classId/posts) and top-level (single-post ops, /posts/:postId).
// A single shared Router instance can't do this -- Express router instances
// have one route table, so mounting the same instance at two prefixes would
// expose every route at both (a class-scoped POST / would also become
// reachable as POST /posts with classId undefined). Two separate Router
// instances, each mounted once in server.js, avoids that entirely.
// classScopedPostRoutes needs { mergeParams: true } so req.params.classId
// (defined only in the *mount* path, not in this router's own patterns) is
// visible inside its handlers; postRoutes doesn't need it, since :postId is
// defined directly in its own route patterns.
const express = require("express");
const classScopedPostRoutes = express.Router({ mergeParams: true });
const postRoutes = express.Router();

const {
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
} = require("../controllers/post.controller.js");
const { authenticate, authorize } = require("../middleware/auth.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const { writeLimiter, uploadLimiter } = require("../middleware/rateLimiter.middleware.js");
const {
  createPostSchema,
  updatePostSchema,
  requestPostAttachmentUploadUrlSchema,
  discardPostAttachmentUploadSchema,
} = require("../schemas/validationSchemas.js");

// -- mounted at ${apiV1Path}/classes/:classId/posts --
classScopedPostRoutes.post(
  "/",
  authenticate,
  authorize({ roles: ["teacher"] }),
  writeLimiter,
  validate(createPostSchema),
  createPostController,
);
classScopedPostRoutes.get("/", authenticate, listPostsController);
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

// -- mounted at ${apiV1Path}/posts --
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

module.exports = { classScopedPostRoutes, postRoutes };
