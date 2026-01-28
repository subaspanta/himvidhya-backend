const express = require("express");
const { sendMessage } = require("../controllers/message.controller.js");
const protect = require("../middleware/authMiddleware.js");

const router = express.Router();

router.post("/send", protect, sendMessage);

module.exports = router;
