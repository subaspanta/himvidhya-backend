import mongoose from "mongoose";
import Class from "../models/Class.model.js";
import ClassMember from "../models/ClassMember.model.js";
import JoinRequest from "../models/JoinRequest.model.js";

import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  AuthenticationError,
  ForbiddenError,
} from "../utils/error/errors.js";

import {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
  ownerIdOf,
} from "./guards/class.guards.js";

// Bound list queries to prevent pathological responses.
const SAFETY_LIMIT = 500;

// Shared DTO for class lists, details, and mutations.
const toClassCard = (classDoc, studentCount) => {
  const owner =
    classDoc.owner && typeof classDoc.owner === "object"
      ? {
          _id: classDoc.owner._id.toString(),
          name: classDoc.owner.name,
          email: classDoc.owner.email,
          role: classDoc.owner.role,
          avatar: classDoc.owner.avatar,
        }
      : undefined;

  return {
    id: classDoc._id.toString(),
    name: classDoc.name,
    subject: classDoc.subject,
    description: classDoc.description,
    college: classDoc.college,
    semester: classDoc.semester,
    code: classDoc.joinCode,
    studentCount,
    lastActivity: classDoc.updatedAt
      ? new Date(classDoc.updatedAt).toISOString()
      : null,
    status: classDoc.status || "active",
    createdAt: classDoc.createdAt
      ? new Date(classDoc.createdAt).toISOString()
      : null,
    owner,
  };
};

const createClassService = async ({ name, subject, description }, userId) => {
  if (!userId) {
    throw new AuthenticationError("User ID required to create class");
  }

  const joinCode = await Class.generateUniqueCode();

  const newClass = await Class.create({
    name,
    subject: subject || undefined,
    description: description?.trim() || undefined,
    joinCode,
    owner: userId,
  });

  await newClass.populate("owner", "name email avatar role");

  // A brand-new class has no members yet -- no ClassMember query needed.
  return toClassCard(newClass, 0);
};

// Create a pending join request for a student.
const joinClassService = async (code, userId) => {
  if (!code || !userId) {
    throw new BadRequestError("Class code and user ID are required");
  }

  const classDoc = await Class.findOne({ joinCode: code });

  if (!classDoc) {
    throw new NotFoundError("Class not found with this code");
  }

  // Archived classes reject new join requests with 403.
  assertClassWritable(classDoc);

  // Owners are not stored as ClassMember rows.
  const isOwner = ownerIdOf(classDoc) === userId.toString();
  const activeMembership = await ClassMember.findOne({
    classId: classDoc._id,
    userId,
    status: "active",
  });

  if (isOwner || activeMembership) {
    throw new ConflictError("You are already a member of this class");
  }

  // Prevent duplicate pending requests.
  const existingRequest = await JoinRequest.findOne({
    class: classDoc._id,
    user: userId,
    status: "pending",
  });

  if (existingRequest) {
    throw new ConflictError(
      "You already have a pending request for this class",
    );
  }

  // Store the pending request.
  const joinRequest = await JoinRequest.create({
    class: classDoc._id,
    user: userId,
    type: "request",
    status: "pending",
  });

  return joinRequest;
};

// Approve a request and activate class membership.
const approveJoinRequestService = async (requestId, teacherId) => {
  if (!requestId || !teacherId) {
    throw new BadRequestError("Request ID and teacher ID are required");
  }

  const joinRequest = await JoinRequest.findById(requestId);

  if (!joinRequest) {
    throw new NotFoundError("Join request not found");
  }

  if (joinRequest.status !== "pending") {
    throw new ConflictError("This request has already been resolved");
  }

  const classDoc = await Class.findById(joinRequest.class);

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  // Only the class owner can approve requests.
  assertClassOwner(classDoc, teacherId, {
    message: "Only the class teacher can approve requests",
  });

  // Approval is blocked on archived classes; rejection remains allowed.
  assertClassWritable(classDoc);

  // Never create a membership row for the class owner.
  if (ownerIdOf(classDoc) === joinRequest.user.toString()) {
    throw new ConflictError("Class owner cannot be added as a member");
  }

  // Guard against an already-active membership.
  const existingActiveMembership = await ClassMember.findOne({
    classId: classDoc._id,
    userId: joinRequest.user,
    status: "active",
  });

  if (existingActiveMembership) {
    throw new ConflictError("User is already a member of this class");
  }

  // Reactivate an old row instead of creating a duplicate.
  await ClassMember.findOneAndUpdate(
    { classId: classDoc._id, userId: joinRequest.user },
    { $set: { status: "active", joinedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  // Mark the request resolved.
  joinRequest.status = "approved";
  joinRequest.resolvedAt = new Date();
  joinRequest.resolvedBy = teacherId;
  await joinRequest.save();

  return joinRequest;
};

// Reject a pending join request.
const rejectJoinRequestService = async (requestId, teacherId) => {
  if (!requestId || !teacherId) {
    throw new BadRequestError("Request ID and teacher ID are required");
  }

  const joinRequest = await JoinRequest.findById(requestId);

  if (!joinRequest) {
    throw new NotFoundError("Join request not found");
  }

  if (joinRequest.status !== "pending") {
    throw new ConflictError("This request has already been resolved");
  }

  const classDoc = await Class.findById(joinRequest.class);

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  // Only the class owner can reject requests.
  assertClassOwner(classDoc, teacherId, {
    message: "Only the class teacher can reject requests",
  });

  // Rejection is allowed on archived classes; approval is not.

  // Mark request as rejected and increment rejection count
  joinRequest.status = "rejected";
  joinRequest.resolvedAt = new Date();
  joinRequest.resolvedBy = teacherId;
  joinRequest.rejectionCount += 1;
  await joinRequest.save();

  return joinRequest;
};

// Get all pending join requests for all classes owned by a teacher
const getTeacherJoinRequestsService = async (teacherId) => {
  if (!teacherId) {
    throw new AuthenticationError("Teacher ID required");
  }

  // Find all classes this teacher owns
  const teacherClasses = await Class.find({ owner: teacherId }).select(
    "_id name",
  );

  if (!teacherClasses.length) return [];

  const classIds = teacherClasses.map((c) => c._id);

  // Find all pending requests for those classes
  const requests = await JoinRequest.find({
    class: { $in: classIds },
    status: "pending",
  })
    .populate("user", "name email avatar")
    .populate("class", "name subject")
    .sort({ createdAt: -1 })
    .limit(SAFETY_LIMIT)
    .lean();

  return requests;
};

// Get pending join request count across all teacher's classes (for badge)
const getTeacherJoinRequestsCountService = async (teacherId) => {
  if (!teacherId) {
    throw new AuthenticationError("Teacher ID required");
  }

  const teacherClasses = await Class.find({ owner: teacherId }).select("_id");
  const classIds = teacherClasses.map((c) => c._id);

  const count = await JoinRequest.countDocuments({
    class: { $in: classIds },
    status: "pending",
  });

  return count;
};

const getMyClassesService = async (userId) => {
  if (!userId) {
    throw new AuthenticationError("User ID required");
  }

  // Include owned classes because owners have no membership rows.
  const memberClassIds = await ClassMember.find({
    userId,
    status: "active",
  }).distinct("classId");

  const classes = await Class.find({
    $or: [{ owner: userId }, { _id: { $in: memberClassIds } }],
  })
    .select(
      "name subject description college semester joinCode owner createdAt updatedAt status",
    )
    .populate("owner", "name email avatar role")
    .sort({ createdAt: -1 })
    .limit(SAFETY_LIMIT)
    .lean();

  if (classes.length === 0) {
    return classes;
  }

  const classIds = classes.map((cls) => cls._id);
  const counts = await ClassMember.aggregate([
    { $match: { classId: { $in: classIds }, status: "active" } },
    { $group: { _id: "$classId", count: { $sum: 1 } } },
  ]);
  const countByClassId = new Map(
    counts.map((c) => [c._id.toString(), c.count]),
  );

  return classes.map((cls) =>
    toClassCard(cls, countByClassId.get(cls._id.toString()) || 0),
  );
};

const getClassByIdService = async (classId, userId) => {
  if (!classId || !userId) {
    throw new BadRequestError("Class ID and user ID are required");
  }

  const classDoc = await Class.findById(classId)
    .populate("owner", "name email avatar role")
    .lean();

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  // Archives block writes, not reads.

  // Allow owners and active members only.
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });

  // Return only the count; the roster has its own endpoint.
  const membersCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return {
    ...toClassCard(classDoc, membersCount),
    membersCount,
  };
};

// Return active members; the owner is not a ClassMember row.
const getClassMembersService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId);

  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });

  const memberRows = await ClassMember.find({
    classId: classDoc._id,
    status: "active",
  })
    .populate("userId", "name email avatar role")
    .sort({ joinedAt: 1 })
    .limit(SAFETY_LIMIT)
    .lean();

  const members = memberRows.map((row) => ({
    user: row.userId,
    joinedAt: row.joinedAt,
  }));

  return {
    members,
    membersCount: members.length,
  };
};

// Update class metadata; cover images belong to the materials flow.
const updateClassService = async (classId, userId, updates) => {
  const classDoc = await loadClassOrThrow(classId, { populateOwner: true });

  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  Object.assign(classDoc, updates);
  await classDoc.save();

  const studentCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return toClassCard(classDoc, studentCount);
};

// Archiving an archived class is a conflict, not an authorization failure.
const archiveClassService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId, { populateOwner: true });

  assertClassOwner(classDoc, userId);

  if (classDoc.status === "archived") {
    throw new ConflictError("Class is already archived");
  }

  classDoc.status = "archived";
  await classDoc.save();

  const studentCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return toClassCard(classDoc, studentCount);
};

// Restore requires the archived state, so it bypasses assertClassWritable.
const restoreClassService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId, { populateOwner: true });

  assertClassOwner(classDoc, userId);

  if (classDoc.status === "active") {
    throw new ConflictError("Class is already active");
  }

  classDoc.status = "active";
  await classDoc.save();

  const studentCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return toClassCard(classDoc, studentCount);
};

// Replace the join code without changing existing memberships.
const regenerateJoinCodeService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId, { populateOwner: true });

  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  classDoc.joinCode = await Class.generateUniqueCode();
  await classDoc.save();

  const studentCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return toClassCard(classDoc, studentCount);
};

// Leaving remains allowed when a class is archived.
const leaveClassService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId);

  const { isOwner, membership } = await assertActiveMember(classDoc, userId);

  if (isOwner) {
    throw new ForbiddenError("The class owner cannot leave their own class");
  }

  membership.status = "left";
  await membership.save();

  return membership;
};

// Removing a member remains allowed when a class is archived.
const removeClassMemberService = async (classId, ownerId, targetUserId) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, ownerId);

  // Validate the second path id before querying to avoid a CastError.
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new NotFoundError("Class member not found");
  }

  const membership = await ClassMember.findOne({
    classId: classDoc._id,
    userId: targetUserId,
    status: "active",
  });

  if (!membership) {
    throw new NotFoundError("Class member not found");
  }

  membership.status = "removed";
  await membership.save();

  return membership;
};

export {
  createClassService,
  joinClassService,
  approveJoinRequestService,
  rejectJoinRequestService,
  getTeacherJoinRequestsService,
  getTeacherJoinRequestsCountService,
  getMyClassesService,
  getClassByIdService,
  updateClassService,
  archiveClassService,
  restoreClassService,
  regenerateJoinCodeService,
  getClassMembersService,
  leaveClassService,
  removeClassMemberService,
};
