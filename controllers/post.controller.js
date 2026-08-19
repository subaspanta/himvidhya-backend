const {
  createPostService,
  listPostsFeedService,
  getPostByIdService,
  updatePostService,
  deletePostService,
  pinPostService,
  unpinPostService,
  requestPostAttachmentUploadUrlService,
  discardPostAttachmentUploadService,
  getPostAttachmentDownloadUrlService,
} = require("../services/post.service.js");
const {
  createdResponse,
  successResponse,
  noContentResponse,
} = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

const createPostController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { title, content, attachments } = req.body;
  const post = await createPostService(classId, req.auth.userId, {
    title,
    content,
    attachments,
  });
  return createdResponse(res, { post }, "Post created successfully");
});

const requestPostAttachmentUploadUrlController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { fileName, mimeType, size } = req.body;
  const result = await requestPostAttachmentUploadUrlService(classId, req.auth.userId, {
    fileName,
    mimeType,
    size,
  });
  return successResponse(res, result, "Upload URL issued successfully");
});

const discardPostAttachmentUploadController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  await discardPostAttachmentUploadService(classId, req.auth.userId, req.body);
  return noContentResponse(res);
});

const getPostAttachmentDownloadUrlController = asyncHandler(async (req, res) => {
  const { postId, attachmentId } = req.params;
  const result = await getPostAttachmentDownloadUrlService(
    postId,
    attachmentId,
    req.auth.userId,
  );
  return successResponse(res, result, "Download URL issued successfully");
});

// First real caller of successResponse's meta (5th) argument.
const listPostsController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { cursor, limit } = req.query;
  const { posts, meta } = await listPostsFeedService(classId, req.auth.userId, {
    cursor,
    limit,
  });
  return successResponse(res, { posts }, "Posts retrieved successfully", 200, meta);
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

module.exports = {
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
};
