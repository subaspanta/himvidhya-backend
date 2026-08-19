const Post = require("../models/Post.model.js");
const {
  ConflictError,
  BadRequestError,
  NotFoundError,
  UnprocessableEntityError,
} = require("../utils/error/errors.js");
const {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} = require("./guards/class.guards.js");
const { loadPostOrThrow, assertPostAuthor } = require("./guards/post.guards.js");
const { presignPut, presignGet } = require("../config/storage.js");
const {
  assertUploadable,
  buildStorageKey,
  verifyUploadedObject,
  stripNestedStorageKeys,
  discardObject,
} = require("./attachmentStorage.service.js");
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

// Matches watch?v=, youtu.be/, embed/, and shorts/ URL forms. Thumbnail URL
// is built from YouTube's own public, unauthenticated image convention --
// no external API call needed.
const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const extractYoutubeThumbnail = (url) => {
  const match = YOUTUBE_ID_PATTERN.exec(url);
  if (!match) {
    throw new BadRequestError("Invalid YouTube URL");
  }
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
};

// Resolves client-submitted attachment specs into the shape actually
// stored on Post.attachments. File entries are verified against the real
// object via verifyUploadedObject -- the "don't trust the client's
// declared mimeType/size a second time" gap that closes for every
// presigned-upload feature (attachmentStorage.service.js).
const resolveAttachmentsForSave = async (classDoc, attachments) => {
  return Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.type === "link") {
        return { type: "link", url: attachment.url };
      }

      if (attachment.type === "youtube") {
        return {
          type: "youtube",
          url: attachment.url,
          thumbnailUrl: extractYoutubeThumbnail(attachment.url),
        };
      }

      const { mimeType, size } = await verifyUploadedObject(
        attachment.storageKey,
        `classes/${classDoc._id}/posts/`,
      );

      return {
        type: "file",
        fileName: attachment.fileName,
        mimeType,
        size,
        storageKey: attachment.storageKey,
      };
    }),
  );
};

// storageKey never leaves the server (ADR-0005), applied to every post
// response the same way (attachmentStorage.service.js).
const stripAttachments = (post) => stripNestedStorageKeys(post, "attachments");

const fileStorageKeys = (attachments) =>
  (attachments || [])
    .filter((attachment) => attachment.type === "file")
    .map((attachment) => attachment.storageKey);

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

const createPostService = async (
  classId,
  teacherId,
  { title, content, attachments = [] },
) => {
  if (!title || !content) {
    throw new BadRequestError("Title and content are required");
  }

  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, teacherId);
  assertClassWritable(classDoc);

  const resolvedAttachments = await resolveAttachmentsForSave(classDoc, attachments);

  const post = await Post.create({
    title,
    content,
    classId: classDoc._id,
    authorId: teacherId,
    attachments: resolvedAttachments,
  });

  await post.populate("authorId", "name email avatar role");

  return stripAttachments(post);
};

// Step 1 of the attachment flow: authorize + validate declared
// MIME/size, issue a presigned PUT for a server-generated key. No DB write
// -- the key is only persisted once the post is created/updated with it
// (resolveAttachmentsForSave verifies the object then).
const requestPostAttachmentUploadUrlService = async (
  classId,
  userId,
  { fileName, mimeType, size },
) => {
  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);
  assertUploadable({ mimeType, size });

  const storageKey = buildStorageKey(`classes/${classDoc._id}/posts`, fileName);
  const uploadUrl = await presignPut(storageKey, { contentType: mimeType });

  return { uploadUrl, storageKey };
};

// Composer-side cleanup: a file gets PUT to storage the moment it's
// selected, before any post exists. If the composer removes it (or the
// draft is abandoned) before submit, the object would otherwise sit
// unreferenced forever -- this is the same "no silent accumulation"
// policy Materials applies on remove/replace/delete, just triggered from
// the client instead of a DB write.
const discardPostAttachmentUploadService = async (classId, userId, { storageKey }) => {
  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, userId);

  if (!storageKey || !storageKey.startsWith(`classes/${classDoc._id}/posts/`)) {
    throw new BadRequestError("Invalid storage key for this class");
  }

  await discardObject(storageKey, { classId: classDoc._id.toString(), userId });
};

// File bytes are only ever reachable through a freshly-signed, short-lived
// URL, never a URL embedded in the post response.
const getPostAttachmentDownloadUrlService = async (postId, attachmentId, userId) => {
  const post = await loadPostOrThrow(postId);
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });

  const attachment = post.attachments.id(attachmentId);
  if (!attachment || attachment.type !== "file") {
    throw new NotFoundError("Attachment not found");
  }

  const downloadUrl = await presignGet(attachment.storageKey);
  return { downloadUrl, fileName: attachment.fileName };
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
    return Post.find(filter)
      .sort(PINNED_SORT)
      .limit(limit)
      .populate("authorId", "name email avatar role")
      .lean();
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

  return { posts: posts.map(stripAttachments), meta: buildPageMeta({ hasMore, nextCursor }) };
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
  return stripAttachments(post);
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

  let removedFileKeys = [];
  if (updates.attachments !== undefined) {
    const oldFileKeys = fileStorageKeys(post.attachments);
    post.attachments = await resolveAttachmentsForSave(classDoc, updates.attachments);
    const newFileKeys = new Set(fileStorageKeys(post.attachments));
    removedFileKeys = oldFileKeys.filter((key) => !newFileKeys.has(key));
  }

  await post.save();

  // Best-effort, after save: the record is already authoritative, a
  // cleanup failure here just leaves a logged orphan (attachmentStorage's
  // discardObject), same policy Materials applies on replace.
  await Promise.all(removedFileKeys.map((key) => discardObject(key, { postId: post._id.toString() })));

  await post.populate("authorId", "name email avatar role");
  return stripAttachments(post);
};

const deletePostService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId);
  assertPostAuthor(post, userId);
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassWritable(classDoc);

  if (post.deletedAt) {
    throw new ConflictError("Post is already deleted");
  }

  const fileKeys = fileStorageKeys(post.attachments);

  post.deletedAt = new Date();
  await post.save();

  // Post soft-delete has no restore path (I7 only guarantees the tombstone
  // metadata stays retrievable, not its attachments -- PostAttachments.tsx
  // never renders them once isDeleted). Effectively final, so the file
  // objects are cleaned up the same as Materials' hard delete.
  await Promise.all(fileKeys.map((key) => discardObject(key, { postId: post._id.toString() })));

  await post.populate("authorId", "name email avatar role");
  return stripAttachments(post);
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
  ).populate("authorId", "name email avatar role");
  if (!updated) throw new ConflictError("Post is already pinned");
  return stripAttachments(updated);
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
  await post.populate("authorId", "name email avatar role");
  return stripAttachments(post);
};

module.exports = {
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
};
