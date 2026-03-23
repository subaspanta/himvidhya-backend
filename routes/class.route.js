const express = require("express");
const router = express.Router();

const {
  createClassController,
  joinClassController,
  approveJoinRequestController,
  rejectJoinRequestController,
  getTeacherJoinRequestsController,
  getTeacherJoinRequestsCountController,
  getMyClassesController,
  getClassByIdController,
} = require("../controllers/class.controller");

const { authenticate, authorize } = require("../middleware/auth.middleware.js");

// Class CRUD
router.post(
  "/",
  authenticate,
  authorize({ roles: ["teacher", "admin"] }),
  createClassController,
);

router.get("/my", authenticate, getMyClassesController);

// Join flow
router.post("/join", authenticate, joinClassController);

// Join requests (teacher only)
router.get(
  "/requests/count",
  authenticate,
  authorize({ roles: ["teacher", "admin"] }),
  getTeacherJoinRequestsCountController,
);

router.get(
  "/requests",
  authenticate,
  authorize({ roles: ["teacher", "admin"] }),
  getTeacherJoinRequestsController,
);

router.patch(
  "/requests/:requestId/approve",
  authenticate,
  authorize({ roles: ["teacher", "admin"] }),
  approveJoinRequestController,
);

router.patch(
  "/requests/:requestId/reject",
  authenticate,
  authorize({ roles: ["teacher", "admin"] }),
  rejectJoinRequestController,
);

router.get("/:id", authenticate, getClassByIdController);
module.exports = router;
