const {
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
} = require("../services/class.service.js");

const { BadRequestError } = require("../utils/error/errors.js");
const {
  createdResponse,
  successResponse,
} = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

// Create a new class (teacher only)
const createClassController = asyncHandler(async (req, res) => {
  const { name, subject, description } = req.body;

  if (!name) {
    throw new BadRequestError("Class name is required");
  }

  const classData = await createClassService(
    { name, subject, description },
    req.auth.userId,
  );

  return createdResponse(
    res,
    { class: classData },
    "Class created successfully",
  );
});

// Student requests to join a class using join code
const joinClassController = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new BadRequestError("Join code is required");
  }

  const joinRequest = await joinClassService(code, req.auth.userId);

  return createdResponse(
    res,
    { joinRequest },
    "Join request submitted successfully",
  );
});

// Teacher approves a join request
const approveJoinRequestController = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  if (!requestId) {
    throw new BadRequestError("Request ID is required");
  }

  const joinRequest = await approveJoinRequestService(
    requestId,
    req.auth.userId,
  );

  return successResponse(
    res,
    { joinRequest },
    "Join request approved successfully",
  );
});

// Teacher rejects a join request
const rejectJoinRequestController = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  if (!requestId) {
    throw new BadRequestError("Request ID is required");
  }

  const joinRequest = await rejectJoinRequestService(
    requestId,
    req.auth.userId,
  );

  return successResponse(
    res,
    { joinRequest },
    "Join request rejected successfully",
  );
});

// Get all pending join requests for teacher's classes (for sidebar list)
const getTeacherJoinRequestsController = asyncHandler(async (req, res) => {
  const requests = await getTeacherJoinRequestsService(req.auth.userId);

  return successResponse(
    res,
    { requests },
    "Join requests retrieved successfully",
  );
});

// Get pending join request count (for sidebar badge)
const getTeacherJoinRequestsCountController = asyncHandler(async (req, res) => {
  const count = await getTeacherJoinRequestsCountService(req.auth.userId);

  return successResponse(
    res,
    { count },
    "Join request count retrieved successfully",
  );
});

// Get all classes the current user is part of
const getMyClassesController = asyncHandler(async (req, res) => {
  const classes = await getMyClassesService(req.auth.userId);

  const batches = (classes || []).map((cls) => {
    const lastActivity = cls.updatedAt ? cls.updatedAt.toISOString() : null;

    return {
      id: cls._id,
      name: cls.name,
      subject: cls.subject,
      code: cls.joinCode,
      studentCount: cls.studentCount || 0,
      lastActivity,
      unreadMessages: 0,
      status: cls.status || "active",
      owner: cls.owner,
    };
  });

  return successResponse(
    res,
    { classes: batches },
    "Classes retrieved successfully",
  );
});

// Get details of a specific class (only if member)
const getClassByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError("Class ID is required");
  }

  const classData = await getClassByIdService(id, req.auth.userId);

  return successResponse(
    res,
    { class: classData },
    "Class details retrieved successfully",
  );
});

// Teacher edits their own class's metadata
const updateClassController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const classData = await updateClassService(
    classId,
    req.auth.userId,
    req.body,
  );

  return successResponse(res, { class: classData }, "Class updated successfully");
});

// Owner archives their own class
const archiveClassController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const classData = await archiveClassService(classId, req.auth.userId);

  return successResponse(res, { class: classData }, "Class archived successfully");
});

// Owner restores their own archived class
const restoreClassController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const classData = await restoreClassService(classId, req.auth.userId);

  return successResponse(res, { class: classData }, "Class restored successfully");
});

// Owner regenerates their class's join code
const regenerateJoinCodeController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const classData = await regenerateJoinCodeService(classId, req.auth.userId);

  return successResponse(
    res,
    { class: classData },
    "Join code regenerated successfully",
  );
});

// Roster for a class — active members only
const getClassMembersController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const result = await getClassMembersService(classId, req.auth.userId);

  return successResponse(res, result, "Class members retrieved successfully");
});

// Student leaves a class they are an active member of
const leaveClassController = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const membership = await leaveClassService(classId, req.auth.userId);

  return successResponse(res, { membership }, "Left class successfully");
});

// Owner removes a student from their class
const removeClassMemberController = asyncHandler(async (req, res) => {
  const { classId, userId } = req.params;

  const membership = await removeClassMemberService(
    classId,
    req.auth.userId,
    userId,
  );

  return successResponse(res, { membership }, "Member removed successfully");
});

module.exports = {
  createClassController,
  joinClassController,
  approveJoinRequestController,
  rejectJoinRequestController,
  getTeacherJoinRequestsController,
  getTeacherJoinRequestsCountController,
  getMyClassesController,
  getClassByIdController,
  updateClassController,
  archiveClassController,
  restoreClassController,
  regenerateJoinCodeController,
  getClassMembersController,
  leaveClassController,
  removeClassMemberController,
};
