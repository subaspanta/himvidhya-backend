const express = require("express");
const {
  register,
  login,
  forgetPassword,
  resetPassword,
} = require("../controllers/auth.controller.js");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forget-password", forgetPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;
