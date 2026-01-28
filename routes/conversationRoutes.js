const express = require("express");
const {
  getConversations,
  createNewConversation,
  getMessages,
} = require("../controllers/conversation.controller.js");
const protect = require("../middleware/authMiddleware.js");

const router = express.Router();

// Get all conversations for user
router.get("/", protect, getConversations);

// Create new conversation
router.post("/", protect, createNewConversation);

// Get messages in conversation
router.get("/:conversationId/messages", protect, getMessages);

module.exports = router;
