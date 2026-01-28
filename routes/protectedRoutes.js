const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const userRoutes = require("./userRoutes.js");
const conversationRoutes = require("./conversationRoutes.js");
const messageRoutes = require("./messageRoutes.js");

const router = express.Router();

// All chat-related routes are protected
router.use("/users", protect, userRoutes);
router.use("/conversations", protect, conversationRoutes);
router.use("/messages", protect, messageRoutes);

module.exports = router;
