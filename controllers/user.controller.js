import {
  getAllUsers,
  getUserById,
  updateUserProfile,
  searchUsers,
} from "../services/user.service.js";

export const getUsers = async (req, res, next) => {
  try {
    const users = await getAllUsers();

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;

    const user = await updateUserProfile(req.params.id, req.userId, {
      name,
      avatar,
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

export const searchUser = async (req, res, next) => {
  try {
    const { q } = req.query;

    const users = await searchUsers(q);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    if (error.message === "Please provide search query") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};
