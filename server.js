const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/database.js");
const {
  HandleErrorWithLogger,
  HandleUnCaughtException,
  HandleUnhandledRejection,
  handleNotFound,
} = require("./utils/error");
const authRoutes = require("./routes/auth.route.js");
const classRoutes = require("./routes/class.route.js");
const userRoutes = require("./routes/user.route.js");
const { classScopedPostRoutes, postRoutes } = require("./routes/post.route.js");

const cookieParser = require("cookie-parser");
const { getVersionedPath } = require("./config/apiVersion.js");

dotenv.config();

const app = express();
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

function getDbStatus() {
  const state = mongoose.connection.readyState;

  if (state === 1) return "up";
  if (state === 2) return "connecting";
  return "down";
}

function healthPayload() {
  return {
    status: "ok",
    service: "lms-backend",
    version: process.env.npm_package_version || "unknown",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    db: getDbStatus(),
  };
}

// Liveness/readiness probes for local and CI checks.
app.get("/health", (_req, res) => {
  const payload = healthPayload();
  const code = payload.db === "up" ? 200 : 503;
  res.status(code).json(payload);
});

// API Routes with versioning
const apiV1Path = getVersionedPath("v1");
app.get(`${apiV1Path}/health`, (_req, res) => {
  const payload = healthPayload();
  const code = payload.db === "up" ? 200 : 503;
  res.status(code).json(payload);
});
app.use(`${apiV1Path}/auth`, authRoutes);
app.use(`${apiV1Path}/classes`, classRoutes);
app.use(`${apiV1Path}/classes/:classId/posts`, classScopedPostRoutes);
app.use(`${apiV1Path}/posts`, postRoutes);
app.use(`${apiV1Path}/users`, userRoutes);

// 404 handler
app.use(handleNotFound);

app.use(HandleErrorWithLogger);

process.on("uncaughtException", HandleUnCaughtException);

process.on("unhandledRejection", HandleUnhandledRejection);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const requiredEnvVars = [
      "MONGODB_URI",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "ACCESS_TOKEN_EXPIRES_IN",
      "REFRESH_TOKEN_EXPIRES_IN",
      "CLIENT_URL",
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`,
      );
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
