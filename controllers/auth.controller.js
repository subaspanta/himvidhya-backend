const { generateToken } = require("../config/jwt.js");
const errorHandler = require("../middleware/errorHandler.js");
const { logger } = require("../logger.js");
const {
  forgetPasswordService,
  loginUserService,
  registerUserService,
  resetPasswordService,
  verifyOTPService,
} = require("../services/auth.service.js");
const { sendOTPEmail } = require("../utils/email.js");
const User = require("../models/User.js");
const {
  createdResponse,
  successResponse,
  errorResponse,
  conflictResponse,
  unauthorizedResponse,
} = require("../utils/responseParser.js");

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
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Log successful registration
    logger.info(`User registered: ${email} (ID: ${user._id})`);

    return createdResponse(
      res,
      { user: user.toJSON() },
      "User registered successfully",
    );
  } catch (error) {
    if (error.message === "Email or username already exists") {
      logger.warn(
        `Registration failed: ${req.body.email} - Email/username already exists`,
      );
      return conflictResponse(res, error.message);
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
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Log successful login
    logger.info(`User logged in: ${email} (ID: ${user._id})`);

    return successResponse(res, { user: user.toJSON() }, "Login successful");
  } catch (error) {
    if (error.message === "Invalid credentials") {
      logger.warn(`Login failed: ${req.body.email} - Invalid credentials`);
      return unauthorizedResponse(res, error.message);
    }
    logger.error(`Login error for ${req.body.email}: ${error.message}`);
    next(error);
  }
};
const logout = (req, res, next) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    // Log logout event
    logger.info(`User logged out: ${req.user?.email || "Unknown"}`);

    return successResponse(res, null, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

const forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const otp = await forgetPasswordService(email);
    if (otp) {
      await sendOTPEmail(email, otp);
      logger.info(`Password reset OTP sent to: ${email}`);
    } else {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
    }
    return successResponse(res, null, "If email exists, OTP has been sent");
  } catch (error) {
    logger.error(
      `Forget password error for ${req.body.email}: ${error.message}`,
    );
    return errorResponse(res, error.message || "Internal server error", 500);
  }
};

const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const result = await verifyOTPService(email, otp);

    logger.info(`OTP verified successfully for: ${email}`);

    return successResponse(
      res,
      { valid: result.valid },
      "OTP verified successfully",
    );
  } catch (error) {
    if (error.message === "Invalid or expired OTP") {
      logger.warn(`OTP verification failed for ${req.body.email}`);
      return errorResponse(res, error.message, 400);
    }
    logger.error(`OTP verification error: ${error.message}`);
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    // Data is already validated by Zod middleware
    const user = await resetPasswordService(email, otp, password);

    // Auto-login: generate token and set cookie
    const tokenValue = generateToken(user);
    res.cookie("token", tokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Log successful password reset
    logger.info(
      `Password reset successful for user: ${user.email} (ID: ${user._id})`,
    );

    return successResponse(
      res,
      { user: user.toJSON() },
      "Password updated successfully",
    );
  } catch (error) {
    if (error.message === "Invalid or expired OTP") {
      logger.warn(`Password reset failed: Invalid or expired OTP`);
      return errorResponse(res, error.message, 400);
    }
    logger.error(`Password reset error: ${error.message}`);
    next(error);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    // req.user already populated by protect middleware
    const user = req.user;

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    logger.info(`[AUTH] getCurrentUser - userId: ${user._id}`);

    return successResponse(
      res,
      {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
      },
      "User retrieved successfully",
    );
  } catch (error) {
    logger.error(`[AUTH] getCurrentUser error: ${error.message}`);
    return errorResponse(res, "Failed to fetch user", 500);
  }
};

module.exports = {
  register,
  login,
  logout,
  forgetPassword,
  verifyOTP,
  resetPassword,
  getCurrentUser,
};
