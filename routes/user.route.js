const express = require("express");
const {
  getUsers,
  getUser,
  updateUser,
  searchUser,
} = require("../controllers/user.controller.js");
const { authenticate } = require("../middleware/auth.middleware.js");
const User = require("../models/User.model.js");

const router = express.Router();

// Search users (must come before /:id to avoid conflict)
router.get("/search", authenticate, searchUser);

// Get all users
router.get("/", authenticate, getUsers);

// Get user profile
router.get("/:id", authenticate, getUser);

// Update user profile
router.put("/:id", authenticate, updateUser);

router.get("/profile", authenticate, async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  res.json(user);
});

module.exports = router;
