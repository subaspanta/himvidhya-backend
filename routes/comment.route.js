// Comments nest under Posts, not Classes -- postScopedCommentRoutes needs
// { mergeParams: true } so req.params.postId (defined only in the mount
// path) is visible inside its handlers, mirroring post.route.js's
// classScopedPostRoutes. commentRoutes (top-level /comments/:commentId)
// doesn't need it, since :commentId is defined in its own route patterns.
import express from "express";

const postScopedCommentRoutes = express.Router({ mergeParams: true });
const commentRoutes = express.Router();

import {
  createCommentController,
  listCommentsController,
  updateCommentController,
  deleteCommentController,
} from "../controllers/comment.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import validate from "../middleware/validateRequest.middleware.js";
import { writeLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  createCommentSchema,
  updateCommentSchema,
} from "../schemas/validationSchemas.js";

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

export { postScopedCommentRoutes, commentRoutes };
