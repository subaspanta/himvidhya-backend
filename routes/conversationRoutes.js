const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// Get all conversations for user
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// Create new conversation
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: "Please provide participant ID" });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, participantId] },
    });

    if (conversation) {
      return res.json(conversation);
    }

    // Create new conversation
    conversation = new Conversation({
      participants: [req.userId, participantId],
    });

    await conversation.save();
    await conversation.populate("participants", "-password");

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

// Get messages in conversation
router.get(
  "/:conversationId/messages",
  authMiddleware,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const messages = await Message.find({ conversation: conversationId })
        .populate("sender", "-password")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      res.json(messages.reverse());
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
