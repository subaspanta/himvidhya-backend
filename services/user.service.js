import User from "../models/User.js";

export const getAllUsers = async () => {
  const users = await User.find().select("-passwordHash");
  return users;
};

export const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const updateUserProfile = async (
  userId,
  requestingUserId,
  { name, avatar },
) => {
  // Only user can update their own profile
  if (userId !== requestingUserId) {
    throw new Error("Unauthorized");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { name, avatar },
    { new: true },
  ).select("-passwordHash");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const searchUsers = async (query) => {
  if (!query) {
    throw new Error("Please provide search query");
  }

  const users = await User.find({
    $or: [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  })
    .select("-passwordHash")
    .limit(10);

  return users;
};
