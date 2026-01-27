import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  searchUser,
} from "../controllers/user.controller.js";
import { protect } from "../middleware/authMiddleware.js";

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
  const user = await User.findById(req.userId).select("-password");
  res.json(user);
});

export default router;
