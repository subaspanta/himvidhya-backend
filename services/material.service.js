import crypto from "crypto";
import path from "path";
import Material from "../models/Material.model.js";
import { logger } from "../logger.js";
import { BadRequestError } from "../utils/error/errors.js";

import {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
} from "./guards/class.guards.js";

import { loadMaterialOrThrow } from "./guards/material.guards.js";
import {
  presignPut,
  presignGet,
  headObject,
  deleteObject,
} from "../config/storage.js";
import {
  MAX_MATERIAL_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "../config/materialRules.js";
import {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
} from "../utils/cursor.js";

const DEFAULT_MATERIAL_PAGE_SIZE = 20; // API Contract §5.2 (D14)
const MATERIAL_SORT = { createdAt: -1, _id: -1 };

const assertUploadable = ({ mimeType, size }) => {
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestError("File type is not supported");
  }
  if (!size || size > MAX_MATERIAL_SIZE_BYTES) {
    throw new BadRequestError("File exceeds the 25MB size limit");
  }
};

const buildStorageKey = (classId, fileName) => {
  const ext = path.extname(fileName || "").toLowerCase();
  return `classes/${classId}/${crypto.randomUUID()}${ext}`;
};

const stripStorageKey = (material) => {
  const plain =
    typeof material.toObject === "function" ? material.toObject() : material;
  delete plain.storageKey;
  return plain;
};

// Issue the upload URL; create metadata only after confirmation.
const requestMaterialUploadUrlService = async (
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

// Confirm the stored object's metadata instead of trusting the client.
const confirmMaterialUploadService = async (
  classId,
  userId,
  { storageKey, title, description, fileName },
) => {
  const classDoc = await loadClassOrThrow(classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  if (!storageKey || !storageKey.startsWith(`classes/${classDoc._id}/`)) {
    throw new BadRequestError("Invalid storage key for this class");
  }

  const meta = await headObject(storageKey);
  if (!meta) {
    throw new BadRequestError(
      "Uploaded file not found -- the upload may have failed or expired",
    );
  }
  assertUploadable({ mimeType: meta.ContentType, size: meta.ContentLength });

  const material = await Material.create({
    title,
    description,
    fileName,
    mimeType: meta.ContentType,
    size: meta.ContentLength,
    storageKey,
    classId: classDoc._id,
    uploadedBy: userId,
  });

  await material.populate("uploadedBy", "name email avatar role");
  return stripStorageKey(material);
};

const listMaterialsService = async (
  classId,
  userId,
  { cursor: rawCursor, limit: rawLimit, q } = {},
) => {
  const classDoc = await loadClassOrThrow(classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  // Archived classes remain readable and downloadable.

  const take = clampLimit(rawLimit, {
    defaultLimit: DEFAULT_MATERIAL_PAGE_SIZE,
  });
  const decoded = rawCursor ? decodeCursor(rawCursor) : null;
  const fetchTarget = take + 1;

  // Combine cursor and search filters so neither overwrites the other.
  const conditions = [{ classId: classDoc._id }];
  if (decoded) {
    conditions.push(buildCursorQuery({ cursor: decoded, direction: "desc" }));
  }
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    conditions.push({
      $or: [
        { title: pattern },
        { description: pattern },
        { fileName: pattern },
      ],
    });
  }
  const filter = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const rows = await Material.find(filter)
    .sort(MATERIAL_SORT)
    .limit(fetchTarget)
    .populate("uploadedBy", "name email avatar role")
    .select("-storageKey")
    .lean();

  const hasMore = rows.length > take;
  const materials = hasMore ? rows.slice(0, take) : rows;
  const lastDoc = materials[materials.length - 1];
  const nextCursor = lastDoc
    ? encodeCursor({
        createdAt: lastDoc.createdAt,
        _id: lastDoc._id.toString(),
      })
    : null;

  return { materials, meta: buildPageMeta({ hasMore, nextCursor }) };
};

const getMaterialByIdService = async (materialId, userId) => {
  const material = await loadMaterialOrThrow(materialId, {
    populateUploader: true,
    lean: true,
  });
  const classDoc = await loadClassOrThrow(material.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });
  return stripStorageKey(material);
};

const getMaterialDownloadUrlService = async (materialId, userId) => {
  const material = await loadMaterialOrThrow(materialId);
  const classDoc = await loadClassOrThrow(material.classId);
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });

  const downloadUrl = await presignGet(material.storageKey);
  return { downloadUrl, fileName: material.fileName };
};

// Only accept replacement keys after headObject verifies the upload.
const updateMaterialService = async (materialId, userId, updates) => {
  const material = await loadMaterialOrThrow(materialId);
  const classDoc = await loadClassOrThrow(material.classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  if (updates.title !== undefined) material.title = updates.title;
  if (updates.description !== undefined)
    material.description = updates.description;

  let replacedStorageKey = null;
  if (updates.storageKey && updates.storageKey !== material.storageKey) {
    if (!updates.storageKey.startsWith(`classes/${classDoc._id}/`)) {
      throw new BadRequestError("Invalid storage key for this class");
    }
    const meta = await headObject(updates.storageKey);
    if (!meta) {
      throw new BadRequestError(
        "Replacement file not found -- the upload may have failed or expired",
      );
    }
    assertUploadable({ mimeType: meta.ContentType, size: meta.ContentLength });

    replacedStorageKey = material.storageKey;
    material.storageKey = updates.storageKey;
    material.mimeType = meta.ContentType;
    material.size = meta.ContentLength;
    if (updates.fileName) material.fileName = updates.fileName;
  }

  await material.save();

  if (replacedStorageKey) {
    // Metadata is authoritative; log, rather than undo, cleanup failures.
    try {
      await deleteObject(replacedStorageKey);
    } catch (err) {
      logger.warn("Failed to delete replaced material object", {
        storageKey: replacedStorageKey,
        error: err.message,
      });
    }
  }

  await material.populate("uploadedBy", "name email avatar role");
  return stripStorageKey(material);
};

// Issue a new replacement key; update the record only after verification.
const requestMaterialReplaceUrlService = async (
  materialId,
  userId,
  { fileName, mimeType, size },
) => {
  const material = await loadMaterialOrThrow(materialId);
  const classDoc = await loadClassOrThrow(material.classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);
  assertUploadable({ mimeType, size });

  const storageKey = buildStorageKey(classDoc._id, fileName);
  const uploadUrl = await presignPut(storageKey, { contentType: mimeType });

  return { uploadUrl, storageKey };
};

// Hard-delete the object first, then remove its metadata record.
const deleteMaterialService = async (materialId, userId) => {
  const material = await loadMaterialOrThrow(materialId);
  const classDoc = await loadClassOrThrow(material.classId);
  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  try {
    await deleteObject(material.storageKey);
  } catch (err) {
    logger.warn("Failed to delete material object during deletion", {
      storageKey: material.storageKey,
      error: err.message,
    });
  }

  await Material.deleteOne({ _id: material._id });
};

export {
  requestMaterialUploadUrlService,
  confirmMaterialUploadService,
  listMaterialsService,
  getMaterialByIdService,
  getMaterialDownloadUrlService,
  updateMaterialService,
  requestMaterialReplaceUrlService,
  deleteMaterialService,
};
