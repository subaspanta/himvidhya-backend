const express = require("express");
const protect = require("../middleware/authMiddleware.js");
const userRoutes = require("./userRoutes.js");
const messageRoutes = require("./messageRoutes.js");
const classesRoutes = require("./classesRoutes.js");

const router = express.Router();

// All chat-related routes are protected
router.use("/users", protect, userRoutes);
router.use("/messages", protect, messageRoutes);
router.use("/classes", protect, classesRoutes);

module.exports = router;
