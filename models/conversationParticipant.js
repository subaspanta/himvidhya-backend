const mongoose = require("mongoose");

const conversationParticipantSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      required: true,
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

// Compound index to ensure a user can only be in a conversation once
conversationParticipantSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "ConversationParticipant",
  conversationParticipantSchema,
);
