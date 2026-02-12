const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const connectDB = require("./config/database.js");
const {
  HandleErrorWithLogger,
  HandleUnCaughtException,
  HandleUnhandledRejection,
  handleNotFound,
} = require("./utils/error");
const authRoutes = require("./routes/authRoutes.js");
const protectedRoutes = require("./routes/protectedRoutes.js");
const initializeSocket = require("./sockets/chatSocket.js");
const cookieParser = require("cookie-parser");
const { getVersionedPath, API_VERSION } = require("./config/apiVersion.js");

dotenv.config();

const app = express();
const server = http.createServer(app);

// const io = new SocketIO(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || "http://localhost:3000",
//     methods: ["GET", "POST"],
//   },
// });

const helmet = require("helmet");

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// API Routes with versioning
const apiV1Path = getVersionedPath("v1");
app.use(`${apiV1Path}/auth`, authRoutes);
app.use(apiV1Path, protectedRoutes);

// 404 handler
app.use(handleNotFound);

app.use(HandleErrorWithLogger);

process.on("uncaughtException", HandleUnCaughtException);

process.on("unhandledRejection", HandleUnhandledRejection);

// initializeSocket(io);
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"];
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`,
      );
    }

    if (process.env.NODE_ENV === "production") {
      const emailEnvVars = [
        "EMAIL_SENDER_USER",
        "EMAIL_SENDER_PASSWORD",
        "FRONTEND_URL",
      ];
      const missingEmailVars = emailEnvVars.filter(
        (envVar) => !process.env[envVar],
      );
      if (missingEmailVars.length > 0) {
        throw new Error(
          `Missing email configuration variables: ${missingEmailVars.join(", ")}`,
        );
      }
    }

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
