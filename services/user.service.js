const User = require("../models/User.model.js");
const { NotFoundError } = require("../utils/error/errors.js");

const getCurrentUserService = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

module.exports = {
  getCurrentUserService,
};
