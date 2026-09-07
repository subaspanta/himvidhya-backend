// The nested router needs mergeParams to read postId from its mount path.
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

// Mounted at /posts/:postId/comments; membership is checked in the service.
postScopedCommentRoutes.post(
  "/",
  authenticate,
  writeLimiter,
  validate(createCommentSchema),
  createCommentController,
);
postScopedCommentRoutes.get("/", authenticate, listCommentsController);

// Mounted at /comments.
commentRoutes.patch(
  "/:commentId",
  authenticate,
  validate(updateCommentSchema),
  updateCommentController,
);
commentRoutes.delete("/:commentId", authenticate, deleteCommentController);

export { postScopedCommentRoutes, commentRoutes };
