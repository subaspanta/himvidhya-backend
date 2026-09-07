/** Post lookup and author guards; class checks stay in class.guards.js. */

import mongoose from "mongoose";

import Post from "../../models/Post.model.js";
import { ForbiddenError, NotFoundError } from "../../utils/error/errors.js";

// Normalize raw and populated author values before comparing ids.
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
