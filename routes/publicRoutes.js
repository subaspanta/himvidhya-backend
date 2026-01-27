import express from "express";
import { register, login } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

export default router;
