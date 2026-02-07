const {
  getAllUsers,
  getUserById,
  updateUserProfile,
  searchUsers,
} = require("../services/user.service.js");
const {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  errorResponse,
} = require("../utils/responseParser.js");

const getUsers = async (req, res, next) => {
  try {
    const users = await getAllUsers();
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
    if (error.message === "User not found") {
      return notFoundResponse(res, error.message);
    }
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const user = await updateUserProfile(req.params.id, req.userId, {
      name,
      avatar,
    });
    return successResponse(res, { user }, "User updated successfully");
  } catch (error) {
    if (error.message === "Unauthorized") {
      return forbiddenResponse(res, error.message);
    }
    if (error.message === "User not found") {
      return notFoundResponse(res, error.message);
    }
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
    if (error.message === "Please provide search query") {
      return errorResponse(res, error.message, 400);
    }
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  updateUser,
  searchUser,
};
