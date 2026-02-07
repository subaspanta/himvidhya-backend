const {
  getUserConversations,
  createConversation,
  getConversationMessages,
} = require("../services/conversation.service.js");
const {
  successResponse,
  createdResponse,
  errorResponse,
} = require("../utils/responseParser.js");

const getConversations = async (req, res, next) => {
  try {
    const conversations = await getUserConversations(req.userId);
    return successResponse(
      res,
      { conversations },
      "Conversations retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

const createNewConversation = async (req, res, next) => {
  try {
    const { participantId } = req.body;
    const conversation = await createConversation(req.userId, participantId);
    return createdResponse(
      res,
      { conversation },
      "Conversation created successfully",
    );
  } catch (error) {
    if (error.message === "Please provide participant ID") {
      return errorResponse(res, error.message, 400);
    }
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit, skip } = req.query;
    const messages = await getConversationMessages(conversationId, {
      limit,
      skip,
    });
    return successResponse(
      res,
      { messages },
      "Messages retrieved successfully",
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  createNewConversation,
  getMessages,
};
