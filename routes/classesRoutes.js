const express = require("express");
const router = express.Router();

const {
  createClassController,
  joinClassController,
  getMyClassesController,
  getClassByIdController,
} = require("../controllers/classes.controller");

router.post("/", createClassController);
router.post("/join", joinClassController);
router.get("/my", getMyClassesController);
router.get("/:id", getClassByIdController);

module.exports = router;
