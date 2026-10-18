import Post from "../models/Post.model.js";
import crypto from "crypto";
import path from "path";
import {
  ConflictError,
  BadRequestError,
  UnprocessableEntityError,
} from "../utils/error/errors.js";

import {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} from "./guards/class.guards.js";
import {
  presignPut,
  presignGet,
  headObject,
  deleteObject,
} from "../config/storage.js";
import {
  ALLOWED_MIME_TYPES,
  MAX_MATERIAL_SIZE_BYTES,
} from "../config/materialRules.js";

import { loadPostOrThrow, assertPostAuthor } from "./guards/post.guards.js";
import {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
} from "../utils/cursor.js";

const DEFAULT_POST_PAGE_SIZE = 20; // D14 per-resource default
const MAX_PINNED_POSTS_PER_CLASS = 3; // I5
const PINNED_SORT = { createdAt: -1, _id: -1 };
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const parseHttpUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    return parsed;
  } catch {
    throw new BadRequestError("Enter a valid HTTP or HTTPS URL");
  }
};

const extractYoutubeId = (rawUrl) => {
  const parsed = parseHttpUrl(rawUrl);
  const hostname = parsed.hostname.toLowerCase();
  let videoId = null;

  if (hostname === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    const [route, id] = parsed.pathname.split("/").filter(Boolean);
    if (route === "watch") videoId = parsed.searchParams.get("v");
    if (route === "embed" || route === "shorts") videoId = id ?? null;
  }

  return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? videoId : null;
};

const assertUploadable = ({ mimeType, size }) => {
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestError("File type is not supported");
  }
  if (!size || size > MAX_MATERIAL_SIZE_BYTES) {
    throw new BadRequestError("File exceeds the 25MB size limit");
  }
};

const buildStorageKey = (classId, fileName) =>
  `classes/${classId}/${crypto.randomUUID()}${path.extname(fileName || "").toLowerCase()}`;

const normalizeAttachments = async (classId, attachments = []) => {
  const normalized = [];
  for (const attachment of attachments) {
    if (attachment.type === "file") {
      if (!attachment.storageKey.startsWith(`classes/${classId}/`)) {
        throw new BadRequestError("Invalid storage key for this class");
      }
      const meta = await headObject(attachment.storageKey);
      if (!meta) throw new BadRequestError("Uploaded file not found");
      assertUploadable({
        mimeType: meta.ContentType,
        size: meta.ContentLength,
      });
      normalized.push({
        type: "file",
        fileName: attachment.fileName,
        mimeType: meta.ContentType,
        size: meta.ContentLength,
        storageKey: attachment.storageKey,
      });
      continue;
    }

    if (attachment.type === "youtube") {
      const videoId = extractYoutubeId(attachment.url);
      if (!videoId) throw new BadRequestError("Enter a valid YouTube URL");
      normalized.push({
        type: "youtube",
        url: attachment.url,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
      continue;
    }

    parseHttpUrl(attachment.url);
    normalized.push({ type: "link", url: attachment.url });
  }
  return normalized;
};

const stripPostStorageKeys = (post) => {
  const plain = typeof post.toObject === "function" ? post.toObject() : post;
  for (const attachment of plain.attachments || [])
    delete attachment.storageKey;
  return plain;
};

// Add the post-specific pin state to the generic cursor validation.
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
  { title, content, attachments },
) => {
  if (!title || !content) {
    throw new BadRequestError("Title and content are required");
  }

  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, teacherId);
  assertClassWritable(classDoc);

  const normalizedAttachments = await normalizeAttachments(
    classDoc._id.toString(),
    attachments,
  );

  const post = await Post.create({
    title,
    content,
    classId: classDoc._id,
    authorId: teacherId,
    attachments: normalizedAttachments,
  });

  await post.populate("authorId", "name email avatar role");

  return stripPostStorageKeys(post);
};

const requestPostAttachmentUploadUrlService = async (
  classId,
  userId,
  { fileName, mimeType, size },
) => {
  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);
  assertUploadable({ mimeType, size });
  const storageKey = buildStorageKey(classDoc._id, fileName);
  const uploadUrl = await presignPut(storageKey, { contentType: mimeType });
  return { uploadUrl, storageKey };
};

const discardPostAttachmentUploadService = async (
  classId,
  userId,
  storageKey,
) => {
  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, userId);
  if (!storageKey.startsWith(`classes/${classDoc._id}/`)) {
    throw new BadRequestError("Invalid storage key for this class");
  }
  await deleteObject(storageKey);
};

const getPostAttachmentDownloadUrlService = async (
  postId,
  attachmentId,
  userId,
) => {
  const post = await loadPostOrThrow(postId, {
    select: "+attachments.storageKey",
  });
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  if (post.deletedAt) {
    throw new BadRequestError("File attachment not found");
  }
  const attachment = post.attachments.id(attachmentId);
  if (!attachment || attachment.type !== "file") {
    throw new BadRequestError("File attachment not found");
  }
  return {
    downloadUrl: await presignGet(attachment.storageKey),
    fileName: attachment.fileName,
  };
};

/** Pinned and unpinned posts paginate as separate ordered buckets. */
const listPostsFeedService = async (
  classId,
  userId,
  { cursor: rawCursor, limit: rawLimit } = {},
) => {
  const classDoc = await loadClassOrThrow(classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // Archived classes remain readable.

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

  return { posts, meta: buildPageMeta({ hasMore, nextCursor }) };
};

// Populate the author for the single-post response.
const getPostByIdService = async (postId, userId) => {
  const post = await loadPostOrThrow(postId, {
    populateAuthor: true,
    lean: true,
  });
  const classDoc = await loadClassOrThrow(post.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // Deleted posts remain retrievable as tombstones.
  return post;
};

const updatePostService = async (postId, userId, updates) => {
  const post = await loadPostOrThrow(postId, {
    select: "+attachments.storageKey",
  });
  assertPostAuthor(post, userId); // I9 -- author, not owner
  const classDoc = await loadClassOrThrow(post.classId);
  assertClassWritable(classDoc);

  if (post.deletedAt) {
    throw new ConflictError("Cannot edit a deleted post");
  }

  if (updates.title !== undefined) post.title = updates.title;
  if (updates.content !== undefined) post.content = updates.content;
  let replacedStorageKeys = [];
  if (updates.attachments !== undefined) {
    replacedStorageKeys = (post.attachments || [])
      .filter((attachment) => attachment.type === "file")
      .map((attachment) => attachment.storageKey)
      .filter(Boolean);
    post.attachments = await normalizeAttachments(
      classDoc._id.toString(),
      updates.attachments,
    );
  }
  await post.save();
  const activeStorageKeys = new Set(
    (post.attachments || [])
      .filter((attachment) => attachment.type === "file")
      .map((attachment) => attachment.storageKey),
  );
  await Promise.all(
    replacedStorageKeys
      .filter((storageKey) => !activeStorageKeys.has(storageKey))
      .map((storageKey) => deleteObject(storageKey)),
  );
  await post.populate("authorId", "name email avatar role");
  return stripPostStorageKeys(post);
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
  await post.populate("authorId", "name email avatar role");
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

  // Compare-and-swap prevents double-pinning the same post without a transaction.
  const updated = await Post.findOneAndUpdate(
    { _id: post._id, isPinned: false },
    { $set: { isPinned: true } },
    { new: true },
  ).populate("authorId", "name email avatar role");
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
  await post.populate("authorId", "name email avatar role");
  return post;
};

export {
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
