/**
 * Post-specific guards. Scope: "is this caller allowed to touch this
 * specific post" (I9, author-only edit/delete) -- nothing more. Class-level
 * authorization (owner, active member, writable) is never duplicated here;
 * every Post service function that needs it loads the owning Class via
 * post.classId and reuses loadClassOrThrow/assertClassOwner/
 * assertActiveMember/assertClassWritable from class.guards.js directly.
 */

import mongoose from "mongoose";

import Post from "../../models/Post.model.js";
import { ForbiddenError, NotFoundError } from "../../utils/error/errors.js";

// Mirrors class.guards.js's ownerIdOf: authorId is a raw ObjectId on most
// reads and a populated User subdocument on getPostByIdService's response.
const authorIdOf = (postDoc) => {
  const author = postDoc.authorId;
  const id = author && author._id ? author._id : author;
  return id ? id.toString() : null;
};

const loadPostOrThrow = async (
  postId,
  { populateAuthor = false, lean = false } = {},
) => {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new NotFoundError("Post not found");
  }

  let query = Post.findById(postId);
  if (populateAuthor) {
    query = query.populate("authorId", "name email avatar role");
  }
  if (lean) {
    query = query.lean();
  }

  const post = await query;
  if (!post) {
    throw new NotFoundError("Post not found");
  }

  return post;
};

const assertPostAuthor = (postDoc, userId, { message } = {}) => {
  if (authorIdOf(postDoc) !== userId.toString()) {
    throw new ForbiddenError(
      message || "Only the post author can perform this action",
    );
  }
};

export { loadPostOrThrow, assertPostAuthor, authorIdOf };
