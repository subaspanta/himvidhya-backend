const Class = require("../models/Class.model.js");
const {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require("../utils/error/errors.js");

const createClassService = async ({ name, subject }, userId) => {
  if (!userId) {
    throw new AuthenticationError("User ID required to create class");
  }

  const joinCode = await Class.generateUniqueCode();

  const newClass = await Class.create({
    name,
    subject: subject || undefined,
    joinCode,
    creator: userId,
  });

  return newClass;
};

const joinClassService = async (code, userId) => {
  if (!code || !userId) {
    throw new BadRequestError("Class code and user ID are required");
  }

  const classDoc = await Class.findOne({ joinCode: code });

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
    .select("name subject joinCode members creator createdAt")
    .populate("creator", "name email avatar")
    .sort({ createdAt: -1 })
    .lean();

  return classes;
};

const getClassByIdService = async (classId, userId) => {
  if (!classId || !userId) {
    throw new BadRequestError("Class ID and user ID are required");
  }

  const classDoc = await Class.findById(classId)
    .populate("creator", "name email avatar role") // populate creator details
    .populate("members.user", "name email avatar role") // populate member user details
    .lean(); // lean() makes it faster (plain JS object)

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  // Security: only members can see class details
  const isMember = classDoc.members.some(
    (m) => m.user._id.toString() === userId.toString(),
  );

  if (!isMember) {
    throw new ForbiddenError("You are not a member of this class");
  }

  // Optional: add computed fields for frontend convenience
  classDoc.membersCount = classDoc.members.length;

  return classDoc;
};
module.exports = {
  createClassService,
  joinClassService,
  getMyClassesService,
  getClassByIdService,
};
