const {
  createClassService,
  joinClassService,
  approveJoinRequestService,
  rejectJoinRequestService,
  getTeacherJoinRequestsService,
  getTeacherJoinRequestsCountService,
  getMyClassesService,
  getClassByIdService,
} = require("../services/class.service.js");

const { BadRequestError } = require("../utils/error/errors.js");
const {
  createdResponse,
  successResponse,
} = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

// Create a new class (teacher only)
const createClassController = asyncHandler(async (req, res) => {
  const { name, subject } = req.body;

  if (!name) {
    throw new BadRequestError("Class name is required");
  }

  const classData = await createClassService(
    { name, subject },
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
    const studentCount = Array.isArray(cls.members)
      ? cls.members.filter((m) => m.role === "student").length
      : 0;

    const lastActivity = cls.updatedAt ? cls.updatedAt.toISOString() : null;

    return {
      id: cls._id,
      name: cls.name,
      subject: cls.subject,
      code: cls.joinCode,
      studentCount,
      maxStudents: cls.maxStudents,
      lastActivity,
      unreadMessages: 0,
      attendanceRate: cls.attendanceRate,
      nextDeadline: cls.nextDeadline,
      status: cls.status || "active",
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

module.exports = {
  createClassController,
  joinClassController,
  approveJoinRequestController,
  rejectJoinRequestController,
  getTeacherJoinRequestsController,
  getTeacherJoinRequestsCountController,
  getMyClassesController,
  getClassByIdController,
};
