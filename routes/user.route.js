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

router.get("/search", authenticate, searchUser);

router.get("/", authenticate, getUsers);

router.get("/profile", authenticate, async (req, res) => {
  const user = await User.findById(req.auth.userId).select("-passwordHash");
  res.json(user);
});
router.get("/:id", authenticate, getUser);
router.put("/:id", authenticate, updateUser);

module.exports = router;
