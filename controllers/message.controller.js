const { sendMessageService } = require("../services/message.service.js");

const sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    // populated by auth middleware
    const senderId = req.userId;
    const message = await sendMessageService({
      conversationId,
      senderId,
      content,
    });
    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  sendMessage,
};
