const express = require("express");
const {
  getUsers,
  getUser,
  updateUser,
  searchUser,
} = require("../controllers/user.controller.js");
const protect = require("../middleware/authMiddleware.js");
const User = require("../models/User.js");

const router = express.Router();

// Search users (must come before /:id to avoid conflict)
router.get("/search", protect, searchUser);

// Get all users
router.get("/", protect, getUsers);

// Get user profile
router.get("/:id", protect, getUser);

// Update user profile
router.put("/:id", protect, updateUser);

router.get("/profile", protect, async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  res.json(user);
});

module.exports = router;
