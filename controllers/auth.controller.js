const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../config/jwt");
const { logger } = require("../logger.js");
const {
  forgetPasswordService,
  loginUserService,
  registerUserService,
  resetPasswordService,
  verifyOTPService,
} = require("../services/auth.service.js");
const { sendOTPEmail } = require("../utils/email.js");
const User = require("../models/User.model.js");
const {
  createdResponse,
  successResponse,
  errorResponse,
  conflictResponse,
  unauthorizedResponse,
} = require("../utils/responseParser.js");
const { getPermissionsFromRole } = require("../helpers/permissions.js");

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const { user } = await registerUserService({
      name,
      email,
      password,
    });

    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth/refresh-token",
    });

    // Log successful registration
    logger.info(`User registered: ${email} (ID: ${user._id})`);

    return createdResponse(
      res,
      { user: user.toJSON() },
      "User registered successfully",
    );
  } catch (error) {
    if (error.message === "Email already exists") {
      logger.warn(
        `Registration failed: ${req.body.email} - Email already exists`,
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

    const { user } = await loginUserService({ email, password });

    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth/refresh-token", // optional hardening
    });

    return successResponse(res, { user: user.toJSON() }, "Login successful");
  } catch (error) {
    if (error.message === "Invalid email or password") {
      logger.warn(`Login failed: ${req.body.email} - Invalid credentials`);
      return unauthorizedResponse(res, error.message);
    }
    logger.error(`Login error for ${req.body.email}: ${error.message}`);
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Cookie options must match exactly with how they were set
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    };

    // Clear accessToken cookie
    res.clearCookie("accessToken", {
      ...cookieOptions,
      path: "/",
    });

    // Clear refreshToken cookie
    res.clearCookie("refreshToken", {
      ...cookieOptions,
      path: "/api/v1/auth/refresh-token",
    });

    // Invalidate refresh token in DB
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.refreshToken = null;
        await user.save();
        logger.info(`User logged out: ${user.email} (ID: ${user._id})`);
      }
    }

    return successResponse(res, null, "Logged out successfully");
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
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

    // Auto-login: generate tokens and set cookies
    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth/refresh-token",
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
    const userId = req.user?._id;

    if (!userId) {
      return unauthorizedResponse(res, "Unauthorized");
    }

    // ✅ Always fetch fresh user (important)
    const user = await User.findById(userId).select(
      "_id name email avatar role isVerified",
    );

    if (!user) {
      return unauthorizedResponse(res, "User not found");
    }

    logger.info(`[AUTH] getCurrentUser - userId: ${user._id}`);

    // ✅ DTO shaping (frontend contract)
    const userDTO = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,

      // 🔥 NEW: backend-driven RBAC
      permissions: getPermissionsFromRole(user.role),

      meta: {
        isVerified: user.isVerified,
      },
    };

    return successResponse(res, userDTO, "User retrieved successfully");
  } catch (error) {
    logger.error(`[AUTH] getCurrentUser error: ${error.message}`);
    return errorResponse(res, "Failed to fetch user", 500);
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return unauthorizedResponse(res, "Refresh token missing");
    }

    const payload = verifyRefreshToken(token);

    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== token) {
      return unauthorizedResponse(res, "Invalid refresh token");
    }

    const newAccessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 15 * 60 * 1000,
      path: "/",
    });

    return successResponse(res, null, "Access token refreshed");
  } catch (error) {
    return unauthorizedResponse(res, "Refresh token expired or invalid");
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
  refreshAccessToken,
};
