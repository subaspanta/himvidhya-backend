const Class = require("../models/Class.js");
const {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require("../utils/error/errors.js");

const createClassService = async ({ name, subject }, userId) => {
  // Optional: Check if user has permission (though middleware should handle)
  // But for service-layer safety
  if (!userId) {
    throw new AuthenticationError("User ID required to create class");
  }

  // Generate unique code (using your static method)
  const code = await Class.generateUniqueCode();

  const newClass = await Class.create({
    name,
    subject: subject || undefined,
    code,
    creator: userId,
    // members will auto-include creator as teacher via pre-save hook
  });

  return newClass;
};

const joinClassService = async (code, userId) => {
  if (!code || !userId) {
    throw new BadRequestError("Class code and user ID are required");
  }

  const classDoc = await Class.findOne({ code });

  if (!classDoc) {
    throw new NotFoundError("Class not found with this code");
  }

  // Check if already member
  if (classDoc.isMember(userId)) {
    throw new ConflictError("You are already a member of this class");
  }

  // Add as student
  classDoc.members.push({
    user: userId,
    role: "student",
  });

  await classDoc.save();

  return classDoc;
};

const getMyClassesService = async (userId) => {
  if (!userId) {
    throw new AuthenticationError("User ID required");
  }

  const classes = await Class.find({
    "members.user": userId,
  })
    .select("name subject code members creator createdAt")
    .populate("creator", "name email username avatar")
    .sort({ createdAt: -1 })
    .lean();

  return classes;
};

const getClassByIdService = async (classId, userId) => {
  if (!classId || !userId) {
    throw new BadRequestError("Class ID and user ID are required");
  }

  const classDoc = await Class.findById(classId)
    .populate("creator", "name email username avatar")
    .populate("members.user", "name email username avatar role")
    .lean();

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  if (!classDoc.isMember(userId)) {
    throw new ForbiddenError("You are not a member of this class");
  }

  return classDoc;
};

module.exports = {
  createClassService,
  joinClassService,
  getMyClassesService,
  getClassByIdService,
};
