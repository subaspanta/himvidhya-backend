import Comment from "../models/Comment.model.js";
import { ConflictError, BadRequestError } from "../utils/error/errors.js";

import {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} from "./guards/class.guards.js";

import { loadPostOrThrow } from "./guards/post.guards.js";
import {
  loadCommentOrThrow,
  assertCommentAuthor,
  commentAuthorIdOf,
} from "./guards/comment.guards.js";
import {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
} from "../utils/cursor.js";

const DEFAULT_COMMENT_PAGE_SIZE = 10; // API Contract §5.2 (D14)
const COMMENT_SORT = { createdAt: 1, _id: 1 }; // oldest-first (D6)

const createCommentService = async (postId, userId, { content }) => {
  if (!content) {
    throw new BadRequestError("Content is required");
  }

  const post = await loadPostOrThrow(postId);
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  assertClassWritable(classDoc);

  const comment = await Comment.create({
    postId: post._id,
    authorId: userId,
    content,
  });

  await comment.populate("authorId", "name email avatar role");

  return comment;
};

// Keep deleted comments so the list can render their tombstones.
const listCommentsService = async (
  postId,
  userId,
  { cursor: rawCursor, limit: rawLimit } = {},
) => {
  const post = await loadPostOrThrow(postId);
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // Archived classes remain readable.

  const take = clampLimit(rawLimit, {
    defaultLimit: DEFAULT_COMMENT_PAGE_SIZE,
  });
  const decoded = rawCursor ? decodeCursor(rawCursor) : null;
  const fetchTarget = take + 1;

  const filter = { postId: post._id };
  if (decoded) {
    Object.assign(
      filter,
      buildCursorQuery({ cursor: decoded, direction: "asc" }),
    );
  }

  const rows = await Comment.find(filter)
    .sort(COMMENT_SORT)
    .limit(fetchTarget)
    .populate("authorId", "name email avatar role")
    .lean();

  const hasMore = rows.length > take;
  const comments = hasMore ? rows.slice(0, take) : rows;
  const lastDoc = comments[comments.length - 1];
  const nextCursor = lastDoc
    ? encodeCursor({
        createdAt: lastDoc.createdAt,
        _id: lastDoc._id.toString(),
      })
    : null;

  return { comments, meta: buildPageMeta({ hasMore, nextCursor }) };
};

const updateCommentService = async (commentId, userId, updates) => {
  const comment = await loadCommentOrThrow(commentId);
  assertCommentAuthor(comment, userId); // I9 -- author only, never the teacher
  const post = await loadPostOrThrow(comment.postId);
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassWritable(classDoc);

  if (comment.deletedAt) {
    throw new ConflictError("Cannot edit a deleted comment");
  }

  comment.content = updates.content;
  await comment.save();
  await comment.populate("authorId", "name email avatar role");
  return comment;
};

// Authors and class owners may delete comments.
const deleteCommentService = async (commentId, userId) => {
  const comment = await loadCommentOrThrow(commentId);
  const post = await loadPostOrThrow(comment.postId);
  const classDoc = await loadClassOrThrow(post.classId);

  if (commentAuthorIdOf(comment) !== userId.toString()) {
    assertClassOwner(classDoc, userId, {
      message:
        "Only the comment author or class teacher can delete this comment",
    });
  }

  assertClassWritable(classDoc);

  if (comment.deletedAt) {
    throw new ConflictError("Comment is already deleted");
  }

  comment.deletedAt = new Date();
  await comment.save();
  await comment.populate("authorId", "name email avatar role");
  return comment;
};

export {
  createCommentService,
  listCommentsService,
  updateCommentService,
  deleteCommentService,
};
