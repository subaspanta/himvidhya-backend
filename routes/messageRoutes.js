const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

// Send message (REST endpoint, Socket.IO handles real-time)
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { conversation, content } = req.body;

    if (!conversation || !content) {
      return res
        .status(400)
        .json({ error: "Please provide conversation ID and content" });
    }

    const message = new Message({
      conversation,
      sender: req.userId,
      content,
    });

    await message.save();
    await message.populate("sender", "-password");

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

// Mark message as read
router.put("/:messageId/read", authMiddleware, async (req, res, next) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { read: true },
      { new: true },
    );

    res.json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
