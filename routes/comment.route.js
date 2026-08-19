// Comments nest under Posts, not Classes -- postScopedCommentRoutes needs
// { mergeParams: true } so req.params.postId (defined only in the mount
// path) is visible inside its handlers, mirroring post.route.js's
// classScopedPostRoutes. commentRoutes (top-level /comments/:commentId)
// doesn't need it, since :commentId is defined in its own route patterns.
const express = require("express");
const postScopedCommentRoutes = express.Router({ mergeParams: true });
const commentRoutes = express.Router();

const {
  createCommentController,
  listCommentsController,
  updateCommentController,
  deleteCommentController,
} = require("../controllers/comment.controller.js");
const { authenticate } = require("../middleware/auth.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const { writeLimiter } = require("../middleware/rateLimiter.middleware.js");
const {
  createCommentSchema,
  updateCommentSchema,
} = require("../schemas/validationSchemas.js");

// -- mounted at ${apiV1Path}/posts/:postId/comments --
// No authorize({roles}) -- both teacher and active student may comment
// (API Contract §6.6); membership is checked inside the service.
postScopedCommentRoutes.post(
  "/",
  authenticate,
  writeLimiter,
  validate(createCommentSchema),
  createCommentController,
);
postScopedCommentRoutes.get("/", authenticate, listCommentsController);

// -- mounted at ${apiV1Path}/comments --
commentRoutes.patch(
  "/:commentId",
  authenticate,
  validate(updateCommentSchema),
  updateCommentController,
);
commentRoutes.delete("/:commentId", authenticate, deleteCommentController);

module.exports = { postScopedCommentRoutes, commentRoutes };
