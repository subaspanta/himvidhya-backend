const express = require("express");
const {
  register,
  login,
  forgetPassword,
  resetPassword,
} = require("../controllers/auth.controller.js");
const protect = require("../middleware/authMiddleware.js");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forget-password", forgetPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
