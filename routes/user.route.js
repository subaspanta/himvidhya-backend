const express = require("express");
const { getCurrentUser } = require("../controllers/user.controller.js");
const { authenticate } = require("../middleware/auth.middleware.js");

const router = express.Router();

router.get("/me", authenticate, getCurrentUser);

module.exports = router;
