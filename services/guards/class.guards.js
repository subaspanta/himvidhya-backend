/** Shared class authorization guards. Business-specific conflicts stay in services. */

import mongoose from "mongoose";

import Class from "../../models/Class.model.js";
import ClassMember from "../../models/ClassMember.model.js";
import { ForbiddenError, NotFoundError } from "../../utils/error/errors.js";

// Normalize raw and populated owner values before comparing ids.
function ownerIdOf(classDoc) {
  const owner = classDoc.owner;
  const id = owner && owner._id ? owner._id : owner;
  return id ? id.toString() : null;
}

/** Loads a class by id or throws NotFoundError. */
const loadClassOrThrow = async (classId, { populateOwner = false } = {}) => {
  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    throw new NotFoundError("Class not found");
  }

  const query = Class.findById(classId);

  if (populateOwner) {
    query.populate("owner", "name email avatar role");
  }

  const classDoc = await query;

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  return classDoc;
};

/** Throws unless userId is the class owner. */
const assertClassOwner = (classDoc, userId, { message } = {}) => {
  if (ownerIdOf(classDoc) !== userId.toString()) {
    throw new ForbiddenError(
      message || "Only the class teacher can perform this action",
    );
  }
};

/** Requires class ownership or an active membership row. */
const assertActiveMember = async (classDoc, userId, { message } = {}) => {
  const isOwner = ownerIdOf(classDoc) === userId.toString();

  if (isOwner) {
    return { isOwner: true, membership: null };
  }

  const membership = await ClassMember.findOne({
    classId: classDoc._id,
    userId,
    status: "active",
  });

  if (!membership) {
    throw new ForbiddenError(message || "You are not a member of this class");
  }

  return { isOwner: false, membership };
};

/** Blocks writes to archived classes. */
const assertClassWritable = (classDoc, { message } = {}) => {
  if (classDoc.status === "archived") {
    throw new ForbiddenError(message || "This class has been archived");
  }
};

export {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
  ownerIdOf,
};
