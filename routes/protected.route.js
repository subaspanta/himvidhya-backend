const express = require("express");
const protect = require("../middleware/auth.middleware.js");
const userRoutes = require("./user.route.js");
const classesRoutes = require("./class.route.js");

const router = express.Router();

// All chat-related routes are protected
router.use("/users", protect, userRoutes);
router.use("/classes", protect, classesRoutes);

module.exports = router;
