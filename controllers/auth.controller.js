const { signAccessToken, signRefreshToken } = require("../config/jwt");
const bcrypt = require("bcryptjs");
const { logger } = require("../logger.js");
const {
  forgetPasswordService,
  loginUserService,
  registerUserService,
  resetPasswordService,
  verifyOTPService,
  logoutUserService,
  getCurrentUserService,
  refreshAccessTokenService,
} = require("../services/auth.service.js");
const { sendOTPEmail } = require("../utils/email.js");
const {
  createdResponse,
  successResponse,
} = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const { user } = await registerUserService({ name, email, password, role });

  const accessToken = signAccessToken({ userId: user._id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id });

  // Store only a hashed version of the refresh token in DB
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
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

  logger.info(`User registered: ${email} (ID: ${user._id})`);

  return createdResponse(
    res,
    { user: user.toJSON() },
    "User registered successfully",
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user } = await loginUserService({ email, password });

  const accessToken = signAccessToken({ userId: user._id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id });

  // Store only a hashed version of the refresh token in DB
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
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
});

const logout = asyncHandler(async (req, res) => {
  // Cookie options must match exactly with how they were set
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  };

  res.clearCookie("accessToken", {
    ...cookieOptions,
    path: "/",
  });

  res.clearCookie("refreshToken", {
    ...cookieOptions,
    path: "/api/v1/auth/refresh-token",
  });

  const user = await logoutUserService(req.user?._id);
  if (user) {
    logger.info(`User logged out: ${user.email} (ID: ${user._id})`);
  }

  return successResponse(res, null, "Logged out successfully");
});

const forgetPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const otp = await forgetPasswordService(email);
  if (otp) {
    await sendOTPEmail(email, otp);
    logger.info(`Password reset OTP sent to: ${email}`);
  } else {
    logger.warn(`Password reset requested for non-existent email: ${email}`);
  }
  return successResponse(res, null, "If email exists, OTP has been sent");
});

const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const result = await verifyOTPService(email, otp);

  logger.info(`OTP verified successfully for: ${email}`);

  return successResponse(
    res,
    { valid: result.valid },
    "OTP verified successfully",
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  const user = await resetPasswordService(email, otp, password);

  const accessToken = signAccessToken({ userId: user._id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id });

  user.refreshToken = await bcrypt.hash(refreshToken, 10);
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

  logger.info(
    `Password reset successful for user: ${user.email} (ID: ${user._id})`,
  );

  return successResponse(
    res,
    { user: user.toJSON() },
    "Password updated successfully",
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await getCurrentUserService(req.user?._id);

  logger.info(`[AUTH] getCurrentUser - userId: ${user._id}`);

  const userDTO = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    isActive: user.isActive,
    meta: {
      isVerified: user.isVerified,
    },
  };

  return successResponse(res, userDTO, "User retrieved successfully");
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const user = await refreshAccessTokenService(req.cookies.refreshToken);

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
});

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
