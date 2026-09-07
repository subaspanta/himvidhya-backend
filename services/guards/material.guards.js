/** Material lookup guard; ownership checks stay in class.guards.js. */

import mongoose from "mongoose";

import Material from "../../models/Material.model.js";
import { NotFoundError } from "../../utils/error/errors.js";

const loadMaterialOrThrow = async (
  materialId,
  { populateUploader = false, lean = false } = {},
) => {
  if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
    throw new NotFoundError("Material not found");
  }

  let query = Material.findById(materialId);
  if (populateUploader) {
    query = query.populate("uploadedBy", "name email avatar role");
  }
  if (lean) {
    query = query.lean();
  }

  const material = await query;
  if (!material) {
    throw new NotFoundError("Material not found");
  }

  return material;
};

export { loadMaterialOrThrow };
