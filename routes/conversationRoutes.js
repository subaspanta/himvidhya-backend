import express from "express";
import {
  getConversations,
  createNewConversation,
  getMessages,
} from "../controllers/conversation.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all conversations for user
router.get("/", protect, getConversations);

// Create new conversation
router.post("/", protect, createNewConversation);

// Get messages in conversation
router.get("/:conversationId/messages", protect, getMessages);

export default router;
