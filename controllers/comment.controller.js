import {
  createCommentService,
  listCommentsService,
  updateCommentService,
  deleteCommentService,
} from "../services/comment.service.js";

import { createdResponse, successResponse } from "../utils/responseParser.js";
import asyncHandler from "../helpers/asyncHandler.js";

const createCommentController = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const comment = await createCommentService(postId, req.auth.userId, {
    content,
  });
  return createdResponse(res, { comment }, "Comment created successfully");
});

const listCommentsController = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { cursor, limit } = req.query;
  const { comments, meta } = await listCommentsService(
    postId,
    req.auth.userId,
    { cursor, limit },
  );
  return successResponse(
    res,
    { comments },
    "Comments retrieved successfully",
    200,
    meta,
  );
});

const updateCommentController = asyncHandler(async (req, res) => {
  const comment = await updateCommentService(
    req.params.commentId,
    req.auth.userId,
    req.body,
  );
  return successResponse(res, { comment }, "Comment updated successfully");
});

const deleteCommentController = asyncHandler(async (req, res) => {
  const comment = await deleteCommentService(
    req.params.commentId,
    req.auth.userId,
  );
  return successResponse(res, { comment }, "Comment deleted successfully");
});

export {
  createCommentController,
  listCommentsController,
  updateCommentController,
  deleteCommentController,
};
