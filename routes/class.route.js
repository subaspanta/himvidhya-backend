const express = require("express");
const router = express.Router();

const {
  createClassController,
  joinClassController,
  getMyClassesController,
  getClassByIdController,
} = require("../controllers/class.controller");

const protect = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");

router.post("/", protect, requireRole("teacher"), createClassController);
router.post("/join", protect, joinClassController);
router.get("/my", protect, getMyClassesController);
router.get("/:id", protect, getClassByIdController);

module.exports = router;
