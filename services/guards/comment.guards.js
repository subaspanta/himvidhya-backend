/**
 * Comment-specific guards. Scope: "is this caller allowed to touch this
 * specific comment" (I9, author-only edit) -- nothing more. Mirrors
 * post.guards.js exactly. Class-level authorization (owner, active member,
 * writable) is never duplicated here; every Comment service function that
 * needs it loads the owning Post (for classId) and reuses
 * loadClassOrThrow/assertClassOwner/assertActiveMember/assertClassWritable
 * from class.guards.js directly.
 *
 * The author-or-class-owner OR (moderation delete, I9) is not a reusable
 * authorization primitive shared by anything else -- it is one feature's
 * business rule, composed inline in comment.service.js the same way the
 * owner-as-member regression guard and the "already a member" check in
 * class.service.js stay inline rather than becoming a new guard function.
 */

const mongoose = require("mongoose");
const Comment = require("../../models/Comment.model.js");
const {
  ForbiddenError,
  NotFoundError,
} = require("../../utils/error/errors.js");

// Mirrors post.guards.js's authorIdOf: authorId is a raw ObjectId on most
// reads and a populated User subdocument when populateAuthor is requested.
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

module.exports = { loadCommentOrThrow, assertCommentAuthor, commentAuthorIdOf };
