const { generateToken } = require("../config/jwt.js");
const errorHandler = require("../middleware/errorHandler.js");
const { logger } = require("../logger.js");
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

    // Log successful registration
    logger.info(`User registered: ${email} (ID: ${user._id})`);

    res.status(201).json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Email or username already exists") {
      logger.warn(
        `Registration failed: ${req.body.email} - Email/username already exists`,
      );
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error(`Registration error for ${req.body.email}: ${error.message}`);
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

    // Log successful login
    logger.info(`User logged in: ${email} (ID: ${user._id})`);

    res.json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Invalid credentials") {
      logger.warn(`Login failed: ${req.body.email} - Invalid credentials`);
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }
    logger.error(`Login error for ${req.body.email}: ${error.message}`);
    next(error);
  }
};
const logout = (req, res, next) => {
  try {
    // Verify user is authenticated
    if (!req.cookies.token) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    // Log logout event
    logger.info(`User logged out: ${req.user?.email || "Unknown"}`);

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

const forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const resetToken = await forgetPasswordService(email);
    if (resetToken) {
      const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendResetEmail(email, resetURL);
      logger.info(`Password reset email sent to: ${email}`);
    } else {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
    }
    res.json({
      success: true,
      message: "If email exists, reset link sent",
    });
  } catch (error) {
    logger.error(
      `Forget password error for ${req.body.email}: ${error.message}`,
    );
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

    // Log successful password reset
    logger.info(
      `Password reset successful for user: ${user.email} (ID: ${user._id})`,
    );

    res.json({
      success: true,
      message: "Password updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.message === "Token invalid or expired") {
      logger.warn(`Password reset failed: Invalid or expired token`);
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error(`Password reset error: ${error.message}`);
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
