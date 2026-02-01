const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const connectDB = require("./config/database.js");
const errorHandler = require("./middleware/errorHandler.js");
const fs = require("fs");
// Optionally import logger and file detachment utilities if available
// const { logger } = require("./logger");
// const { handleFileDetachment } = require("./utils/files");
const publicRoutes = require("./routes/publicRoutes.js");
const protectedRoutes = require("./routes/protectedRoutes.js");
const initializeSocket = require("./sockets/chatSocket.js");
const cookieParser = require("cookie-parser");
const { logger } = require("./logger.js");

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/public", publicRoutes);
app.use("/api", protectedRoutes);
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});
// 404 handler with JSON response
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: "Route not found",
  });
});
// Uncaught exception handler
process.on("uncaughtException", function (err) {
  logger.error("Uncaught Exception", err);
  console.error("Uncaught Exception:", err);
});

app.use(function (err, req, res, next) {
  // If you have file detachment logic, call it here
  // if (req.uploadedFiles && req.uploadedFiles.length > 0) {
  //   handleFileDetachment(req.uploadedFiles);
  // }
  res.status(err.status || 500);
  res.json({
    status: err.status || 500,
    message: err.message || err,
  });
});

// Socket.IO
initializeSocket(io);
app.use(cookieParser());
// 🚀 START SERVER ONLY AFTER DB CONNECTS
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
