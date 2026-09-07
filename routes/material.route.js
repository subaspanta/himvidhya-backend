// Split routers keep class-scoped and top-level material paths separate.
// The nested router uses mergeParams to read classId from its mount path.
import express from "express";

const classScopedMaterialRoutes = express.Router({ mergeParams: true });
const materialRoutes = express.Router();

import {
  requestMaterialUploadUrlController,
  confirmMaterialUploadController,
  listMaterialsController,
  getMaterialByIdController,
  getMaterialDownloadUrlController,
  updateMaterialController,
  requestMaterialReplaceUrlController,
  deleteMaterialController,
} from "../controllers/material.controller.js";

import { authenticate, authorize } from "../middleware/auth.middleware.js";
import validate from "../middleware/validateRequest.middleware.js";
import { uploadLimiter } from "../middleware/rateLimiter.middleware.js";

import {
  requestMaterialUploadUrlSchema,
  confirmMaterialUploadSchema,
  updateMaterialSchema,
  requestMaterialReplaceUrlSchema,
} from "../schemas/validationSchemas.js";

// Mounted at /classes/:classId/materials.
classScopedMaterialRoutes.post(
  "/upload-url",
  authenticate,
  authorize({ roles: ["teacher"] }),
  uploadLimiter,
  validate(requestMaterialUploadUrlSchema),
  requestMaterialUploadUrlController,
);
classScopedMaterialRoutes.post(
  "/",
  authenticate,
  authorize({ roles: ["teacher"] }),
  validate(confirmMaterialUploadSchema),
  confirmMaterialUploadController,
);
classScopedMaterialRoutes.get("/", authenticate, listMaterialsController);

// Mounted at /materials.
materialRoutes.get("/:materialId", authenticate, getMaterialByIdController);
materialRoutes.get(
  "/:materialId/download-url",
  authenticate,
  getMaterialDownloadUrlController,
);
materialRoutes.patch(
  "/:materialId",
  authenticate,
  authorize({ roles: ["teacher"] }),
  validate(updateMaterialSchema),
  updateMaterialController,
);
materialRoutes.post(
  "/:materialId/replace-url",
  authenticate,
  authorize({ roles: ["teacher"] }),
  uploadLimiter,
  validate(requestMaterialReplaceUrlSchema),
  requestMaterialReplaceUrlController,
);
materialRoutes.delete(
  "/:materialId",
  authenticate,
  authorize({ roles: ["teacher"] }),
  deleteMaterialController,
);

export { classScopedMaterialRoutes, materialRoutes };
