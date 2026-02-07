const { sendMessageService } = require("../services/message.service.js");
const {
  createdResponse,
  errorResponse,
} = require("../utils/responseParser.js");

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
    return createdResponse(res, { message }, "Message sent successfully");
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
};

module.exports = {
  sendMessage,
};
