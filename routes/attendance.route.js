const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware.js");

// TODO: Add attendance routes here
// Example:
// const { startSession, recordAttendance, getAttendance } = require("../controllers/attendance.controller");
// router.post("/session", authenticate, startSession);
// router.post("/record", authenticate, recordAttendance);
// router.get("/:sessionId", authenticate, getAttendance);

module.exports = router;
