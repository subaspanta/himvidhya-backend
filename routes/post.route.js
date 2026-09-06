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
} from "../controllers/post.controller.js";

import { authenticate, authorize } from "../middleware/auth.middleware.js";
import validate from "../middleware/validateRequest.middleware.js";
import { writeLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  createPostSchema,
  updatePostSchema,
} from "../schemas/validationSchemas.js";

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

export { classScopedPostRoutes, postRoutes };
