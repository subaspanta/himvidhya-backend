// Two-router split, same shape as post.route.js: class-scoped routes need
// { mergeParams: true } to see :classId from the mount path; top-level
// material routes define :materialId in their own patterns.
const express = require("express");
const classScopedMaterialRoutes = express.Router({ mergeParams: true });
const materialRoutes = express.Router();

const {
  requestMaterialUploadUrlController,
  confirmMaterialUploadController,
  listMaterialsController,
  getMaterialByIdController,
  getMaterialDownloadUrlController,
  updateMaterialController,
  requestMaterialReplaceUrlController,
  deleteMaterialController,
} = require("../controllers/material.controller.js");
const { authenticate, authorize } = require("../middleware/auth.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const { uploadLimiter } = require("../middleware/rateLimiter.middleware.js");
const {
  requestMaterialUploadUrlSchema,
  confirmMaterialUploadSchema,
  updateMaterialSchema,
  requestMaterialReplaceUrlSchema,
} = require("../schemas/validationSchemas.js");

// -- mounted at ${apiV1Path}/classes/:classId/materials --
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

// -- mounted at ${apiV1Path}/materials --
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

module.exports = { classScopedMaterialRoutes, materialRoutes };
