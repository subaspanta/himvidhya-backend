const crypto = require("crypto");
const path = require("path");
const { BadRequestError } = require("../utils/error/errors.js");
const { logger } = require("../logger.js");
const { headObject, deleteObject } = require("../config/storage.js");
const {
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} = require("../config/attachmentRules.js");

// Shared by every feature using the presigned-upload flow (ADR-0005):
// declared-value fast-reject against the allow-list/size cap. Never the
// sole enforcement -- verifyUploadedObject below re-checks this against
// the real object before anything is persisted.
const assertUploadable = ({ mimeType, size }) => {
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestError("File type is not supported");
  }
  if (!size || size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new BadRequestError("File exceeds the 25MB size limit");
  }
};

const buildStorageKey = (scopePrefix, fileName) => {
  const ext = path.extname(fileName || "").toLowerCase();
  return `${scopePrefix}/${crypto.randomUUID()}${ext}`;
};

// Closes the "don't trust the client's declared mimeType/size a second
// time" gap: confirms storageKey belongs to the expected class/scope, that
// the object actually landed, and that its real metadata still passes
// assertUploadable. Returns the real ContentType/ContentLength to persist.
const verifyUploadedObject = async (storageKey, expectedPrefix) => {
  if (!storageKey || !storageKey.startsWith(expectedPrefix)) {
    throw new BadRequestError("Invalid storage key for this class");
  }
  const meta = await headObject(storageKey);
  if (!meta) {
    throw new BadRequestError(
      "Uploaded file not found -- the upload may have failed or expired",
    );
  }
  assertUploadable({ mimeType: meta.ContentType, size: meta.ContentLength });
  return { mimeType: meta.ContentType, size: meta.ContentLength };
};

// Strips a top-level storageKey field off a single doc (e.g. Material-style
// records where the file *is* the record).
const stripStorageKey = (doc) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const clone = { ...plain };
  delete clone.storageKey;
  return clone;
};

// Strips storageKey off every entry of a subdocument array field (e.g.
// Post.attachments, where the file is one of several attachments on a
// parent record).
const stripNestedStorageKeys = (doc, arrayField) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    ...plain,
    [arrayField]: (plain[arrayField] || []).map((item) => {
      const clone = { ...item };
      delete clone.storageKey;
      return clone;
    }),
  };
};

// Best-effort cleanup for a storage object no longer referenced by any
// record (a removed/replaced/discarded attachment). A failure here is
// logged, not thrown -- the caller's own state change (record saved,
// attachment dropped from the array) is already authoritative; there is no
// background reconciliation job, so "logged" counts as handled.
const discardObject = async (storageKey, context = {}) => {
  try {
    await deleteObject(storageKey);
  } catch (err) {
    logger.warn("Failed to delete orphaned attachment object", {
      storageKey,
      error: err.message,
      ...context,
    });
  }
};

module.exports = {
  assertUploadable,
  buildStorageKey,
  verifyUploadedObject,
  stripStorageKey,
  stripNestedStorageKeys,
  discardObject,
};
