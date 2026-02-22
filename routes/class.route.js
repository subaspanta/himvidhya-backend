const express = require("express");
const router = express.Router();

const {
  createClassController,
  joinClassController,
  getMyClassesController,
  getClassByIdController,
} = require("../controllers/class.controller");

const {
  authenticate,
  authorize,
  attachUser,
} = require("../middleware/auth.middleware.js");

router.post(
  "/",
  authenticate,
  authorize({ permissions: ["CREATE_CLASS"] }),
  createClassController,
);

router.post("/join", authenticate, joinClassController);
router.get("/my", authenticate, attachUser, getMyClassesController);
router.get("/:id", authenticate, getClassByIdController);

module.exports = router;
