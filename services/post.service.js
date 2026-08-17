const Post = require("../models/Post.model.js");
const {
  ConflictError,
  BadRequestError,
  UnprocessableEntityError,
} = require("../utils/error/errors.js");
const {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} = require("./guards/class.guards.js");
const { loadPostOrThrow, assertPostAuthor } = require("./guards/post.guards.js");
const {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
} = require("../utils/cursor.js");

const DEFAULT_POST_PAGE_SIZE = 20; // D14 per-resource default
const MAX_PINNED_POSTS_PER_CLASS = 3; // I5
const PINNED_SORT = { createdAt: -1, _id: -1 };

// Post-specific cursor decode: cursor.js validates createdAt/_id generically;
// this layers the one extra field the pinned-boundary algorithm below needs,
// without cursor.js knowing Posts (or pinning) exist.
const decodePostCursor = (token) => {
  const decoded = decodeCursor(token);
  if (typeof decoded.isPinned !== "boolean") {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }
  return decoded;
};

const createPostService = async (classId, teacherId, { title, content }) => {
  if (!title || !content) {
    throw new BadRequestError("Title and content are required");
  }

  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, teacherId);
  assertClassWritable(classDoc);

  return Post.create({
    title,
    content,
    classId: classDoc._id,
    authorId: teacherId,
  });
};

/**
 * Pinned-first feed (ADR-0006): pinned posts always fully precede unpinned
 * ones, each bucket internally ordered by (createdAt, _id) desc. Because
 * pinned strictly precedes unpinned in the total order, a cursor only ever
 * needs to record which bucket the last-returned item belonged to plus its
 * position inside that bucket -- there is no third state. buildCursorQuery
 * itself stays fully generic; pin-awareness is composed here by running two
 * independently-paginated bucket queries and carrying isPinned as an extra
 * cursor-payload field.
 */
const listPostsFeedService = async (
  classId,
  userId,
  { cursor: rawCursor, limit: rawLimit } = {},
) => {
  const classDoc = await loadClassOrThrow(classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // No assertClassWritable -- this is a read; archived classes stay
  // readable (C5).

  const take = clampLimit(rawLimit, { defaultLimit: DEFAULT_POST_PAGE_SIZE });
  const decoded = rawCursor ? decodePostCursor(rawCursor) : null;
  const fetchTarget = take + 1;

  const fetchBucket = ({ isPinned, cursor, limit }) => {
    const filter = { classId: classDoc._id, isPinned, deletedAt: null };
    if (cursor) {
      Object.assign(filter, buildCursorQuery({ cursor, direction: "desc" }));
    }
    return Post.find(filter).sort(PINNED_SORT).limit(limit).lean();
  };

  let combined;
  if (!decoded || decoded.isPinned === true) {
    const pinnedCursor = decoded
      ? { createdAt: decoded.createdAt, _id: decoded._id }
      : null;
    combined = await fetchBucket({
      isPinned: true,
      cursor: pinnedCursor,
      limit: fetchTarget,
    });

    if (combined.length < fetchTarget) {
      const unpinned = await fetchBucket({
        isPinned: false,
        cursor: null,
        limit: fetchTarget - combined.length,
      });
      combined = combined.concat(unpinned);
    }
  } else {
    combined = await fetchBucket({
      isPinned: false,
      cursor: { createdAt: decoded.createdAt, _id: decoded._id },
      limit: fetchTarget,
    });
  }

  const hasMore = combined.length > take;
  const posts = hasMore ? combined.slice(0, take) : combined;
  const lastDoc = posts[posts.length - 1];
  const nextCursor = lastDoc
    ? encodeCursor({
        isPinned: lastDoc.isPinned,
        createdAt: lastDoc.createdAt,
        _id: lastDoc._id.toString(),
      })
    : null;

  return { posts, meta: buildPageMeta({ hasMore, nextCursor }) };
};

// Author populated for a richer single-post view (mirrors
// getClassByIdService populating owner).
const getPostByIdService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId, {
    populateAuthor: true,
    lean: true,
  });
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // I7: no deletedAt-based exclusion -- tombstones stay retrievable as-is.
  return post;
};

const updatePostService = async (postId, userId, updates) => {
  const post = await loadPostOrThrow(postId);
  assertPostAuthor(post, userId); // I9 -- author, not owner
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassWritable(classDoc);

  if (post.deletedAt) {
    throw new ConflictError("Cannot edit a deleted post");
  }

  if (updates.title !== undefined) post.title = updates.title;
  if (updates.content !== undefined) post.content = updates.content;
  await post.save();
  return post;
};

const deletePostService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId);
  assertPostAuthor(post, userId);
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassWritable(classDoc);

  if (post.deletedAt) {
    throw new ConflictError("Post is already deleted");
  }

  post.deletedAt = new Date();
  await post.save();
  return post;
};

const pinPostService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId);
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassOwner(classDoc, userId); // pin is an owner action, not author
  assertClassWritable(classDoc);

  if (post.deletedAt) throw new ConflictError("Cannot pin a deleted post");
  if (post.isPinned) throw new ConflictError("Post is already pinned");

  const pinnedCount = await Post.countDocuments({
    classId: post.classId,
    isPinned: true,
    deletedAt: null,
  });
  if (pinnedCount >= MAX_PINNED_POSTS_PER_CLASS) {
    throw new ConflictError("This class already has 3 pinned posts");
  }

  // Single-document compare-and-swap: makes a concurrent double-pin of the
  // SAME post safe without a transaction. The narrow cross-document race
  // (two different posts both passing the count check concurrently) is a
  // documented, accepted tradeoff -- see services/post.service.js's design
  // notes in the implementation plan; not worth a replica-set-only
  // transaction at portfolio scale.
  const updated = await Post.findOneAndUpdate(
    { _id: post._id, isPinned: false },
    { $set: { isPinned: true } },
    { new: true },
  );
  if (!updated) throw new ConflictError("Post is already pinned");
  return updated;
};

const unpinPostService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId);
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  if (post.deletedAt) throw new ConflictError("Cannot modify a deleted post");
  if (!post.isPinned) throw new ConflictError("Post is not pinned");

  post.isPinned = false;
  await post.save();
  return post;
};

module.exports = {
  createPostService,
  listPostsFeedService,
  getPostByIdService,
  updatePostService,
  deletePostService,
  pinPostService,
  unpinPostService,
};
