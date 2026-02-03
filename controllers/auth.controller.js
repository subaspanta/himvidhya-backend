const { generateToken } = require("../config/jwt.js");
const errorHandler = require("../middleware/errorHandler.js");
const {
  forgetPasswordService,
  loginUserService,
  registerUserService,
  resetPasswordService,
} = require("../services/auth.service.js");
const { sendResetEmail } = require("../utils/email.js");

const register = async (req, res, next) => {
  try {
    const { name, email, username, password } = req.body;

    // Data is already validated by Zod middleware
    const { user } = await registerUserService({
      name,
      email,
      username,
      password,
    });

    const token = generateToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Email or username already exists") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Data is already validated by Zod middleware
    const { user } = await loginUserService({ email, password });

    const token = generateToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Invalid credentials") {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};
const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.json({ success: true, message: "Logged out successfully" });
};

const forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const resetToken = await forgetPasswordService(email);
    if (resetToken) {
      const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendResetEmail(email, resetURL);
    }
    res.json({
      success: true,
      message: "If email exists, reset link sent",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Data is already validated by Zod middleware
    const user = await resetPasswordService(token, password);

    // Auto-login: generate token and set cookie
    const tokenValue = generateToken(user);
    res.cookie("token", tokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Password updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Token invalid or expired") {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  forgetPassword,
  resetPassword,
};
