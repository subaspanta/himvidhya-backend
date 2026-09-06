import User from "../models/User.model.js";
import { NotFoundError } from "../utils/error/errors.js";

const getCurrentUserService = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

export { getCurrentUserService };
