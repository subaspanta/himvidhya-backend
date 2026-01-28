const Message = require("../models/Message.js");
const Conversation = require("../models/Conversation.js");
const User = require("../models/User.js");
const { verifyToken } = require("../config/jwt.js");

const activeUsers = new Map(); // Map of userId -> socketId

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Authenticate user
    const token = socket.handshake.auth.token;
    const decoded = verifyToken(token);

    if (!decoded) {
      socket.disconnect();
      return;
    }

    const userId = decoded.userId;
    activeUsers.set(userId, socket.id);

    // Notify others that user is online
    socket.broadcast.emit("user-online", { userId });

    // Join user's personal room for direct messages
    socket.join(`user-${userId}`);

    // Join conversation room
    socket.on("join-room", (conversationId) => {
      socket.join(`conversation-${conversationId}`);
      console.log(`User ${userId} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on("leave-room", (conversationId) => {
      socket.leave(`conversation-${conversationId}`);
    });

    // Handle incoming message
    socket.on("send-message", async (data) => {
      try {
        const { conversationId, content } = data;

        // Save message to database
        const message = new Message({
          conversationId,
          senderId: userId,
          content,
        });

        await message.save();
        await message.populate("senderId", "-passwordHash");

        // Update conversation's last message
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        // Emit to all users in conversation
        io.to(`conversation-${conversationId}`).emit(
          "receive-message",
          message,
        );
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing", (conversationId) => {
      socket
        .to(`conversation-${conversationId}`)
        .emit("user-typing", { userId });
    });

    socket.on("stop-typing", (conversationId) => {
      socket
        .to(`conversation-${conversationId}`)
        .emit("user-stopped-typing", { userId });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      activeUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = chatSocket;
