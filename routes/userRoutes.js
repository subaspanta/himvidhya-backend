const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Get all users
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user profile
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    // Only user can update their own profile
    if (req.userId !== req.params.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, avatar },
      { new: true },
    ).select("-password");

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Search users
router.get("/search", authMiddleware, async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Please provide search query" });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(10);

    res.json(users);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
