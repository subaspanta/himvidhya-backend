const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Message must belong to a class"],
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Message must have a sender"],
      index: true,
    },

    channel: {
      type: String,
      enum: ["announcements", "general", "materials", "assignments", "doubts"],
      default: "general",
      required: true,
      index: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    type: {
      type: String,
      enum: ["text", "file", "system", "deadline"],
      default: "text",
      required: true,
    },

    // For file messages (PDFs, images) - added for Phase 2 readiness
    fileUrl: {
      type: String,
      trim: true,
    },

    fileName: {
      type: String,
      trim: true,
    },

    fileType: {
      type: String, // "pdf", "image/jpeg", etc.
      trim: true,
    },

    // Pinning support (teachers can pin important notices)
    isPinned: {
      type: Boolean,
      default: false,
    },

    // For future replies/threads (optional in Phase 1)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // For read receipts (optional in Phase 1, but easy to add later)
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes – very important for chat performance

messageSchema.index({ class: 1, channel: 1, createdAt: -1 }); // Main index for loading chat history
messageSchema.index({ class: 1, isPinned: 1 }); // Fast pinned messages
messageSchema.index({ sender: 1, createdAt: -1 }); // User's sent messages

// Pre-save hook (optional) – example: auto-set type based on content

messageSchema.pre("save", function (next) {
  if (this.fileUrl && !this.text) {
    this.type = "file";
  }
  next();
});

// Instance method: Check if message is from a specific user

messageSchema.methods.isFromUser = function (userId) {
  return this.sender.toString() === userId.toString();
};

module.exports = mongoose.model("Message", messageSchema);
