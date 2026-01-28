const Conversation = require("../models/Conversation.js");
const Message = require("../models/Message.js");

const getUserConversations = async (userId) => {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .populate("participants", "-passwordHash")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  return conversations;
};

const createConversation = async (userId, participantId) => {
  if (!participantId) {
    throw new Error("Please provide participant ID");
  }

  // Check if conversation already exists
  let conversation = await Conversation.findOne({
    participants: { $all: [userId, participantId] },
  });

  if (conversation) {
    return conversation;
  }

  // Create new conversation
  conversation = await Conversation.create({
    participants: [userId, participantId],
  });

  await conversation.populate("participants", "-passwordHash");

  return conversation;
};

const getConversationMessages = async (
  conversationId,
  { limit = 50, skip = 0 },
) => {
  const messages = await Message.find({ conversationId })
    .populate("senderId", "-passwordHash")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  return messages.reverse();
};

module.exports = {
  getUserConversations,
  createConversation,
  getConversationMessages,
};
