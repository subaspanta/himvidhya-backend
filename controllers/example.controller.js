/**
 * Example Controller demonstrating error handling patterns
 * This shows how to use custom error classes in your controllers
 */

const {
  NotFoundError,
  ValidationError,
  AuthorizeError,
  ConflictError,
  APIError,
} = require("../utils/error");
const User = require("../models/User");

/**
 * Example 1: NotFoundError
 * Use when a requested resource doesn't exist
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Example 2: ConflictError
 * Use when there's a conflict with existing data
 */
const createUser = async (req, res, next) => {
  try {
    const { email, username } = req.body;

    // Check for existing email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new ConflictError("Email already exists");
    }

    // Check for existing username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      throw new ConflictError("Username already taken");
    }

    const user = await User.create(req.body);
    res.status(201).json({ success: true, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Example 3: ValidationError
 * Use for input validation failures
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const { bio } = req.body;

    // Custom validation
    if (bio && bio.length > 500) {
      throw new ValidationError("Bio must be less than 500 characters");
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { bio },
      { new: true },
    );

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Example 4: AuthorizeError
 * Use when user doesn't have permission
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is trying to delete their own account or is admin
    if (req.user.id !== id && req.user.role !== "admin") {
      throw new AuthorizeError("You can only delete your own account");
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Example 5: APIError
 * Use for unexpected internal errors
 */
const processComplexOperation = async (req, res, next) => {
  try {
    // Some complex operation
    const result = await someComplexDatabaseOperation();

    if (!result) {
      // This is an unexpected failure
      throw new APIError("Failed to process operation");
    }

    res.json({ success: true, result });
  } catch (error) {
    // If it's already a custom error, pass it along
    if (
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof AuthorizeError
    ) {
      next(error);
    } else {
      // Wrap unexpected errors
      next(new APIError(error.message || "Internal server error"));
    }
  }
};

/**
 * Example 6: Multiple error checks
 * Handle multiple validation scenarios
 */
const createPost = async (req, res, next) => {
  try {
    const { title, content, userId } = req.body;

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check authorization
    if (req.user.id !== userId) {
      throw new AuthorizeError("You can only create posts for yourself");
    }

    // Validate input
    if (!title || title.length < 3) {
      throw new ValidationError("Title must be at least 3 characters");
    }

    if (!content || content.length < 10) {
      throw new ValidationError("Content must be at least 10 characters");
    }

    // Check for duplicate
    const existingPost = await Post.findOne({ title, userId });
    if (existingPost) {
      throw new ConflictError("You already have a post with this title");
    }

    const post = await Post.create({ title, content, userId });
    res.status(201).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

/**
 * Example 7: Async/await with proper error propagation
 */
const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      throw new ValidationError("Search query must be at least 2 characters");
    }

    const users = await User.find({
      $or: [
        { name: new RegExp(query, "i") },
        { username: new RegExp(query, "i") },
      ],
    }).select("-password");

    res.json({ success: true, users, count: users.length });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserById,
  createUser,
  updateUserProfile,
  deleteUser,
  processComplexOperation,
  createPost,
  searchUsers,
};
