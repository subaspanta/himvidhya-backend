/** Comment lookup and author guard; class-level checks stay in class.guards.js. */

import mongoose from "mongoose";

import Comment from "../../models/Comment.model.js";
import { ForbiddenError, NotFoundError } from "../../utils/error/errors.js";

// Normalize raw and populated author values before comparing ids.
const commentAuthorIdOf = (commentDoc) => {
  const author = commentDoc.authorId;
  const id = author && author._id ? author._id : author;
  return id ? id.toString() : null;
};

const loadCommentOrThrow = async (
  commentId,
  { populateAuthor = false, lean = false } = {},
) => {
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new NotFoundError("Comment not found");
  }

  let query = Comment.findById(commentId);
  if (populateAuthor) {
    query = query.populate("authorId", "name email avatar role");
  }
  if (lean) {
    query = query.lean();
  }

  const comment = await query;
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  return comment;
};

const assertCommentAuthor = (commentDoc, userId, { message } = {}) => {
  if (commentAuthorIdOf(commentDoc) !== userId.toString()) {
    throw new ForbiddenError(
      message || "Only the comment author can perform this action",
    );
  }
};

export { loadCommentOrThrow, assertCommentAuthor, commentAuthorIdOf };
