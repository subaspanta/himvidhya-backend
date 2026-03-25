const User = require("../models/User.model.js");
const { NotFoundError, AuthorizeError } = require("../utils/error/errors.js");

const getAllUsers = async (page = 1, limit = 20) => {
  const users = await User.find({ isActive: true })
    .select("-passwordHash")
    .skip((page - 1) * limit)
    .limit(limit);
  return users;
};

const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

const updateUserProfile = async (
  userId,
  requestingUserId,
  { name, avatar },
) => {
  // Fix: compare as strings to avoid ObjectId vs string mismatch
  if (userId.toString() !== requestingUserId.toString()) {
    throw new AuthorizeError("Unauthorized");
  }

  // Only update fields that are actually provided
  const updates = {};
  if (name) updates.name = name;
  if (avatar) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  ).select("-passwordHash");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

const searchUsers = async (query) => {
  if (!query) {
    throw new Error("Please provide search query");
  }

  const users = await User.find({
    isActive: true,
    $or: [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  })
    .select("-passwordHash")
    .limit(10);

  return users;
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserProfile,
  searchUsers,
};
