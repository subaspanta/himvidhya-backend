const Class = require("../models/Class.model.js");
const ClassMember = require("../models/ClassMember.model.js");
const JoinRequest = require("../models/JoinRequest.model.js");
const {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  AuthenticationError,
} = require("../utils/error/errors.js");

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

  // Block joining an archived class
  if (classDoc.status === "archived") {
    throw new BadRequestError("Cannot join an archived class");
  }

  // Check if already an active member (owner is never a ClassMember — C2)
  const isOwner = classDoc.owner.toString() === userId.toString();
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
  if (classDoc.owner.toString() !== teacherId.toString()) {
    throw new ForbiddenError("Only the class teacher can approve requests");
  }

  // The owner must never become a ClassMember (C2). isMember() used to catch
  // this transitively because the pre-save hook auto-inserted the owner as a
  // member; now that the owner is never in ClassMember, this must be checked
  // explicitly so a legacy or otherwise out-of-band JoinRequest can't upsert
  // an owner row.
  if (classDoc.owner.toString() === joinRequest.user.toString()) {
    throw new ConflictError("User is already a member of this class");
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
  if (classDoc.owner.toString() !== teacherId.toString()) {
    throw new ForbiddenError("Only the class teacher can reject requests");
  }

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

  // Block access to archived classes
  if (classDoc.status === "archived") {
    throw new ForbiddenError("This class has been archived");
  }

  // Security: owner or active member only (owner is never a ClassMember — C2)
  const isOwner = classDoc.owner._id.toString() === userId.toString();
  const activeMembership = isOwner
    ? null
    : await ClassMember.findOne({
        classId: classDoc._id,
        userId,
        status: "active",
      });

  if (!isOwner && !activeMembership) {
    throw new ForbiddenError("You are not a member of this class");
  }

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
    ...classDoc,
    members,
    membersCount: members.length,
  };
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
};
