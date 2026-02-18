const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");

// TODO: Add attendance routes here
// Example:
// const { startSession, recordAttendance, getAttendance } = require("../controllers/attendance.controller");
// router.post("/session", protect, startSession);
// router.post("/record", protect, recordAttendance);
// router.get("/:sessionId", protect, getAttendance);

module.exports = router;
