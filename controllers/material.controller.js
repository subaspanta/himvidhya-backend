const {
  requestMaterialUploadUrlService,
  confirmMaterialUploadService,
  listMaterialsService,
  getMaterialByIdService,
  getMaterialDownloadUrlService,
  updateMaterialService,
  requestMaterialReplaceUrlService,
  deleteMaterialService,
} = require("../services/material.service.js");
const {
  createdResponse,
  successResponse,
  noContentResponse,
} = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

const requestMaterialUploadUrlController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { fileName, mimeType, size } = req.body;
  const result = await requestMaterialUploadUrlService(classId, req.auth.userId, {
    fileName,
    mimeType,
    size,
  });
  return successResponse(res, result, "Upload URL issued successfully");
});

const confirmMaterialUploadController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { storageKey, title, description, fileName } = req.body;
  const material = await confirmMaterialUploadService(classId, req.auth.userId, {
    storageKey,
    title,
    description,
    fileName,
  });
  return createdResponse(res, { material }, "Material created successfully");
});

const listMaterialsController = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { cursor, limit, q } = req.query;
  const { materials, meta } = await listMaterialsService(classId, req.auth.userId, {
    cursor,
    limit,
    q,
  });
  return successResponse(res, { materials }, "Materials retrieved successfully", 200, meta);
});

const getMaterialByIdController = asyncHandler(async (req, res) => {
  const material = await getMaterialByIdService(req.params.materialId, req.auth.userId);
  return successResponse(res, { material }, "Material retrieved successfully");
});

const getMaterialDownloadUrlController = asyncHandler(async (req, res) => {
  const result = await getMaterialDownloadUrlService(req.params.materialId, req.auth.userId);
  return successResponse(res, result, "Download URL issued successfully");
});

const updateMaterialController = asyncHandler(async (req, res) => {
  const material = await updateMaterialService(req.params.materialId, req.auth.userId, req.body);
  return successResponse(res, { material }, "Material updated successfully");
});

const requestMaterialReplaceUrlController = asyncHandler(async (req, res) => {
  const { fileName, mimeType, size } = req.body;
  const result = await requestMaterialReplaceUrlService(req.params.materialId, req.auth.userId, {
    fileName,
    mimeType,
    size,
  });
  return successResponse(res, result, "Replacement upload URL issued successfully");
});

const deleteMaterialController = asyncHandler(async (req, res) => {
  await deleteMaterialService(req.params.materialId, req.auth.userId);
  return noContentResponse(res);
});

module.exports = {
  requestMaterialUploadUrlController,
  confirmMaterialUploadController,
  listMaterialsController,
  getMaterialByIdController,
  getMaterialDownloadUrlController,
  updateMaterialController,
  requestMaterialReplaceUrlController,
  deleteMaterialController,
};
