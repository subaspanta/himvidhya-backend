const Comment = require("../models/Comment.model.js");
const { ConflictError, BadRequestError } = require("../utils/error/errors.js");
const {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} = require("./guards/class.guards.js");
const { loadPostOrThrow } = require("./guards/post.guards.js");
const {
  loadCommentOrThrow,
  assertCommentAuthor,
  commentAuthorIdOf,
} = require("./guards/comment.guards.js");
const {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
} = require("../utils/cursor.js");

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

// Deliberately does not filter deletedAt: null — unlike the post feed,
// comments have no separate single-item GET endpoint, so a deleted
// comment's tombstone (PRD §7.5: "This comment has been deleted.") can only
// ever render from within this list. The client renders the tombstone text
// in place of content when deletedAt is set, same convention as PostCard.
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
  // No assertClassWritable -- this is a read; archived classes stay
  // readable (C5).

  const take = clampLimit(rawLimit, { defaultLimit: DEFAULT_COMMENT_PAGE_SIZE });
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

// I9: author or class owner (moderation) — an OR, composed inline rather
// than as a shared guard; see comment.guards.js's header for why.
const deleteCommentService = async (commentId, userId) => {
  const comment = await loadCommentOrThrow(commentId);
  const post = await loadPostOrThrow(comment.postId);
  const classDoc = await loadClassOrThrow(post.classId);

  if (commentAuthorIdOf(comment) !== userId.toString()) {
    assertClassOwner(classDoc, userId, {
      message: "Only the comment author or class teacher can delete this comment",
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

module.exports = {
  createCommentService,
  listCommentsService,
  updateCommentService,
  deleteCommentService,
};
