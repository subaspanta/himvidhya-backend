import authRoutes from "./auth.route.js";
import classRoutes from "./class.route.js";
import userRoutes from "./user.route.js";
import { classScopedPostRoutes, postRoutes } from "./post.route.js";
import { postScopedCommentRoutes, commentRoutes } from "./comment.route.js";
import { classScopedMaterialRoutes, materialRoutes } from "./material.route.js";

export {
  authRoutes,
  classRoutes,
  userRoutes,
  classScopedPostRoutes,
  postRoutes,
  postScopedCommentRoutes,
  commentRoutes,
  classScopedMaterialRoutes,
  materialRoutes,
};
