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
  updateClassController,
} = require("../controllers/class.controller");

const { authenticate, authorize } = require("../middleware/auth.middleware.js");
const validate = require("../middleware/validateRequest.middleware.js");
const {
  joinClassSchema,
  updateClassSchema,
} = require("../schemas/validationSchemas.js");

// Class CRUD
router.post(
  "/",
  authenticate,
  authorize({ roles: ["teacher"] }),
  createClassController,
);

router.get("/", authenticate, getMyClassesController);

// Join flow
router.post(
  "/join",
  authenticate,
  validate(joinClassSchema),
  authorize({ roles: ["student"] }),
  joinClassController,
);
// Join requests (teacher only)
router.get(
  "/requests/count",
  authenticate,
  authorize({ roles: ["teacher"] }),
  getTeacherJoinRequestsCountController,
);

router.get(
  "/requests",
  authenticate,
  authorize({ roles: ["teacher"] }),
  getTeacherJoinRequestsController,
);

router.patch(
  "/requests/:requestId/approve",
  authenticate,
  authorize({ roles: ["teacher"] }),
  approveJoinRequestController,
);

router.patch(
  "/requests/:requestId/reject",
  authenticate,
  authorize({ roles: ["teacher"] }),
  rejectJoinRequestController,
);

router.patch(
  "/:classId",
  authenticate,
  authorize({ roles: ["teacher"] }),
  validate(updateClassSchema),
  updateClassController,
);

router.get("/:id", authenticate, getClassByIdController);
module.exports = router;
