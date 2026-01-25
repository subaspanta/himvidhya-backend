import express from "express";
import { register, login } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Register
router.post("/register", authLimiter, register);

// Login
router.post("/login", authLimiter, login);

export default router;
