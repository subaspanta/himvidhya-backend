const {
  getAllUsers,
  getUserById,
  updateUserProfile,
  searchUsers,
} = require("../services/user.service.js");
const { successResponse } = require("../utils/responseParser.js");

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await getAllUsers(Number(page), Number(limit));
    return successResponse(res, { users }, "Users retrieved successfully");
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    return successResponse(res, { user }, "User retrieved successfully");
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const user = await updateUserProfile(req.params.id, req.auth.userId, {
      name,
      avatar,
    });
    return successResponse(res, { user }, "User updated successfully");
  } catch (error) {
    next(error);
  }
};

const searchUser = async (req, res, next) => {
  try {
    const { q } = req.query;
    const users = await searchUsers(q);
    return successResponse(
      res,
      { users, query: q },
      "Search completed successfully",
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  updateUser,
  searchUser,
};
