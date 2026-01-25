import {
  getUserConversations,
  createConversation,
  getConversationMessages,
} from "../services/conversation.service.js";

export const getConversations = async (req, res, next) => {
  try {
    const conversations = await getUserConversations(req.userId);

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

export const createNewConversation = async (req, res, next) => {
  try {
    const { participantId } = req.body;

    const conversation = await createConversation(req.userId, participantId);

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    if (error.message === "Please provide participant ID") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit, skip } = req.query;

    const messages = await getConversationMessages(conversationId, {
      limit,
      skip,
    });

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    next(error);
  }
};
