const mongoose = require("mongoose");
const Class = require("../models/Class.model.js");
const ClassMember = require("../models/ClassMember.model.js");
const JoinRequest = require("../models/JoinRequest.model.js");
const {
  ConflictError,
  NotFoundError,
  BadRequestError,
  AuthenticationError,
  ForbiddenError,
} = require("../utils/error/errors.js");
const {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
  ownerIdOf,
} = require("./guards/class.guards.js");

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

  return newClass;
};

// Student requests to join a class — creates a pending JoinRequest
const joinClassService = async (code, userId) => {
  if (!code || !userId) {
    throw new BadRequestError("Class code and user ID are required");
  }

  const classDoc = await Class.findOne({ joinCode: code });

  if (!classDoc) {
    throw new NotFoundError("Class not found with this code");
  }

  // Block joining an archived class (DR2: 403, not 400 — this is an
  // authorization decision, not a malformed-request one)
  assertClassWritable(classDoc);

  // Check if already an active member (owner is never a ClassMember — C2)
  const isOwner = ownerIdOf(classDoc) === userId.toString();
  const activeMembership = await ClassMember.findOne({
    classId: classDoc._id,
    userId,
    status: "active",
  });

  if (isOwner || activeMembership) {
    throw new ConflictError("You are already a member of this class");
  }

  // Check if a pending request already exists
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

  // Create a new join request
  const joinRequest = await JoinRequest.create({
    class: classDoc._id,
    user: userId,
    type: "request",
    status: "pending",
  });

  return joinRequest;
};

// Teacher approves a join request — adds user to class members
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

  // Only the class owner (teacher) can approve
  assertClassOwner(classDoc, teacherId, {
    message: "Only the class teacher can approve requests",
  });

  // Approval is a write; C6/I6/item 19 name it explicitly as an
  // archived-class write category. Rejection is deliberately exempt — see
  // rejectJoinRequestService below and the guards module header.
  assertClassWritable(classDoc);

  // The owner must never become a ClassMember (C2). isMember() used to catch
  // this transitively because the pre-save hook auto-inserted the owner as a
  // member; now that the owner is never in ClassMember, this must be checked
  // explicitly so a legacy or otherwise out-of-band JoinRequest can't upsert
  // an owner row.
  if (ownerIdOf(classDoc) === joinRequest.user.toString()) {
    throw new ConflictError("Class owner cannot be added as a member");
  }

  // Check if somehow already an active member (edge case)
  const existingActiveMembership = await ClassMember.findOne({
    classId: classDoc._id,
    userId: joinRequest.user,
    status: "active",
  });

  if (existingActiveMembership) {
    throw new ConflictError("User is already a member of this class");
  }

  // Create the membership, or reactivate a prior left/removed row for this
  // (class, user) pair rather than inserting a duplicate.
  await ClassMember.findOneAndUpdate(
    { classId: classDoc._id, userId: joinRequest.user },
    { $set: { status: "active", joinedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  // Mark request as approved
  joinRequest.status = "approved";
  joinRequest.resolvedAt = new Date();
  joinRequest.resolvedBy = teacherId;
  await joinRequest.save();

  return joinRequest;
};

// Teacher rejects a join request
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

  // Only the class owner (teacher) can reject
  assertClassOwner(classDoc, teacherId, {
    message: "Only the class teacher can reject requests",
  });

  // No assertClassWritable here, deliberately: API Contract § 6.4, PRD § 7.3
  // and Implementation.md item 19 all scope the archived-class write
  // restriction to approval only. A teacher may clear a pending queue
  // (reject) on an archived class; they may not grow its membership
  // (approve). Covered by class.archive.test.js.

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

  // Owner is never a ClassMember (C2), so a teacher's own classes are found
  // via Class.owner, unioned with classes they hold an active membership in.
  const memberClassIds = await ClassMember.find({
    userId,
    status: "active",
  }).distinct("classId");

  const classes = await Class.find({
    $or: [{ owner: userId }, { _id: { $in: memberClassIds } }],
  })
    .select("name subject joinCode owner createdAt updatedAt status")
    .populate("owner", "name email avatar role")
    .sort({ createdAt: -1 })
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

  return classes.map((cls) => ({
    ...cls,
    studentCount: countByClassId.get(cls._id.toString()) || 0,
  }));
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

  // Archived classes stay readable for existing active members and the
  // owner (C5/I6) — archive blocks writes only. See assertClassWritable in
  // the guards for the write-side enforcement.

  // Security: owner or active member only (owner is never a ClassMember — C2)
  await assertActiveMember(classDoc, userId, {
    message: "You are not a member of this class",
  });

  // The roster itself lives at GET /classes/:classId/members (item 13) —
  // this response carries only the count, not the full member list.
  const membersCount = await ClassMember.countDocuments({
    classId: classDoc._id,
    status: "active",
  });

  return {
    ...classDoc,
    membersCount,
  };
};

// Roster for a class — active ClassMember rows only (Implementation.md
// item 13). The owner is never included; per C2 the owner is not a
// ClassMember, and callers already have the owner from Class.owner /
// getClassByIdService.
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

// Teacher edits their own class's metadata (Implementation.md item 10).
// Cover image is deliberately excluded — the field does not exist on the
// model yet, and the presigned-upload flow it needs lands with Materials.
const updateClassService = async (classId, userId, updates) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  Object.assign(classDoc, updates);
  await classDoc.save();

  return classDoc;
};

// Owner archives their own class (Implementation.md item 11). Deliberately
// does not call assertClassWritable — that guard exists to block ordinary
// writes on an already-archived class, not to express "must currently be
// active". Archiving an already-archived class is a state conflict, not an
// authorization failure, so it follows the existing ConflictError idiom
// used for "already resolved" join requests rather than overloading the
// writable guard's 403 semantics.
const archiveClassService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, userId);

  if (classDoc.status === "archived") {
    throw new ConflictError("Class is already archived");
  }

  classDoc.status = "archived";
  await classDoc.save();

  return classDoc;
};

// Owner restores their own archived class (Implementation.md item 11).
// Same reasoning as archiveClassService in reverse: assertClassWritable
// would incorrectly 403 the one case restore exists to handle (the class
// is archived), so this checks the inverse state directly instead.
const restoreClassService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, userId);

  if (classDoc.status === "active") {
    throw new ConflictError("Class is already active");
  }

  classDoc.status = "active";
  await classDoc.save();

  return classDoc;
};

// Owner regenerates their class's join code (Implementation.md item 12).
// The old code stops resolving to any class immediately; existing
// ClassMember rows are untouched (PRD § 7.3).
const regenerateJoinCodeService = async (classId, userId) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, userId);
  assertClassWritable(classDoc);

  classDoc.joinCode = await Class.generateUniqueCode();
  await classDoc.save();

  return classDoc;
};

// Student leaves a class they are an active member of (Implementation.md
// item 14). No assertClassWritable — I6 and PRD § 7.3 don't list leaving
// among the writes an archived class blocks, so this works identically
// whether the class is active or archived.
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

// Owner removes a student from their class (Implementation.md item 15).
// No assertClassWritable — same I6/PRD § 7.3 reasoning as leaveClassService.
const removeClassMemberService = async (classId, ownerId, targetUserId) => {
  const classDoc = await loadClassOrThrow(classId);

  assertClassOwner(classDoc, ownerId);

  // A malformed :userId would otherwise reach ClassMember.findOne as a raw
  // Mongoose CastError (a 500). loadClassOrThrow makes this same check for
  // :classId; there is no equivalent guard for a second id in the path, so
  // it is repeated here rather than reused from another service, since it
  // is one line and no other id parameter exists yet.
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

module.exports = {
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
