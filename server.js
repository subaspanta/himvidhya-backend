import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIO } from "socket.io";

import connectDB from "./config/database.js";
import errorHandler from "./middleware/errorHandler.js";
import publicRoutes from "./routes/publicRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import initializeSocket from "./sockets/chatSocket.js";
import cookieParser from "cookie-parser";

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

// Public (unauthenticated) routes
app.use("/api/public", publicRoutes);

// Protected (authenticated) chat routes
app.use("/api", protectedRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use(errorHandler);

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
