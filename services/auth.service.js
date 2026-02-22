const User = require("../models/User.model.js");
const crypto = require("crypto");
const {
  ConflictError,
  AuthenticationError,
} = require("../utils/error/errors.js");
const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn } = require("../config/jwt");

function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      permissions: user.permissions,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  );
}

const registerUserService = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  // Create user (password will be hashed by the pre-save hook)
  const user = await User.create({
    name,
    email,
    passwordHash: password,
  });

  return { user };
};
const loginUserService = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AuthenticationError("Invalid credentials");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new AuthenticationError("Invalid credentials");
  }

  return { user };
};

const forgetPasswordService = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return null;

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetPasswordOTP = otp;
  user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();
  return otp;
};

const verifyOTPService = async (email, otp) => {
  const user = await User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });

  if (!user) throw new AuthenticationError("Invalid or expired OTP");
  return { valid: true, userId: user._id };
};

const resetPasswordService = async (email, otp, newPassword) => {
  const user = await User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });

  if (!user) throw new AuthenticationError("Invalid or expired OTP");

  user.passwordHash = newPassword;
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpires = undefined;
  user.passwordChangedAt = new Date();

  await user.save();

  return user;
};

module.exports = {
  registerUserService,
  loginUserService,
  forgetPasswordService,
  verifyOTPService,
  resetPasswordService,
  generateAccessToken,
};
