import {
  createPostService,
  listPostsFeedService,
  getPostByIdService,
  updatePostService,
  deletePostService,
  pinPostService,
  unpinPostService,
} from "../services/post.service.js";

import { createdResponse, successResponse } from "../utils/responseParser.js";
import asyncHandler from "../helpers/asyncHandler.js";

const createPostController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { title, content } = req.body;
  const post = await createPostService(classId, req.auth.userId, {
    title,
    content,
  });
  return createdResponse(res, { post }, "Post created successfully");
});

// First real caller of successResponse's meta (5th) argument.
const listPostsController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { cursor, limit } = req.query;
  const { posts, meta } = await listPostsFeedService(classId, req.auth.userId, {
    cursor,
    limit,
  });
  return successResponse(
    res,
    { posts },
    "Posts retrieved successfully",
    200,
    meta,
  );
});

const getPostByIdController = asyncHandler(async (req, res) => {
  const post = await getPostByIdService(req.params.postId, req.auth.userId);
  return successResponse(res, { post }, "Post retrieved successfully");
});

const updatePostController = asyncHandler(async (req, res) => {
  const post = await updatePostService(
    req.params.postId,
    req.auth.userId,
    req.body,
  );
  return successResponse(res, { post }, "Post updated successfully");
});

const deletePostController = asyncHandler(async (req, res) => {
  const post = await deletePostService(req.params.postId, req.auth.userId);
  return successResponse(res, { post }, "Post deleted successfully");
});

const pinPostController = asyncHandler(async (req, res) => {
  const post = await pinPostService(req.params.postId, req.auth.userId);
  return successResponse(res, { post }, "Post pinned successfully");
});

const unpinPostController = asyncHandler(async (req, res) => {
  const post = await unpinPostService(req.params.postId, req.auth.userId);
  return successResponse(res, { post }, "Post unpinned successfully");
});

export {
  createPostController,
  listPostsController,
  getPostByIdController,
  updatePostController,
  deletePostController,
  pinPostController,
  unpinPostController,
};
