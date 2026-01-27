import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import userRoutes from "./userRoutes.js";
import conversationRoutes from "./conversationRoutes.js";
import messageRoutes from "./messageRoutes.js";

const router = express.Router();

// All chat-related routes are protected
router.use("/users", protect, userRoutes);
router.use("/conversations", protect, conversationRoutes);
router.use("/messages", protect, messageRoutes);

export default router;
