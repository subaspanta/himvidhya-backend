const {
  createClassService,
  joinClassService,
  getMyClassesService,
  getClassByIdService,
} = require("../services/class.service.js");

const { BadRequestError } = require("../utils/error/errors.js");
const asyncHandler = require("../helpers/asyncHandler.js");

// Create a new class (teacher only)

const createClassController = asyncHandler(async (req, res) => {
  const { name, subject } = req.body;

  if (!name) {
    throw new BadRequestError("Class name is required");
  }

  const classData = await createClassService({ name, subject }, req.user._id);

  res.status(201).json({
    success: true,
    message: "Class created successfully",
    data: classData,
  });
});

// Join a class using join code

const joinClassController = asyncHandler(async (req, res) => {
  const { code } = req.body;
  // console.log({ code });
  if (!code) {
    throw new BadRequestError("Join code is required");
  }

  const classData = await joinClassService(code, req.user._id);

  res.json({
    success: true,
    message: "Successfully joined the class",
    data: classData,
  });
});

// Get all classes the current user is part of

const getMyClassesController = asyncHandler(async (req, res) => {
  const classes = await getMyClassesService(req.user._id);

  res.json({
    success: true,
    message: "Classes retrieved successfully",
    data: classes,
  });
});

// Get details of a specific class (only if member)

const getClassByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError("Class ID is required");
  }

  const classData = await getClassByIdService(id, req.user._id);

  res.json({
    success: true,
    message: "Class details retrieved successfully",
    data: classData,
  });
});

module.exports = {
  createClassController,
  joinClassController,
  getMyClassesController,
  getClassByIdController,
};
