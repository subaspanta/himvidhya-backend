import User from "../models/User.model.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ConflictError, AuthenticationError } from "../utils/error/errors.js";
import { verifyRefreshToken } from "../config/jwt.js";

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

const registerUserService = async ({ name, email, password, role }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  // The User pre-save hook hashes the plaintext password.
  const user = await User.create({
    name,
    email,
    passwordHash: password,
    role,
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

  // Store only a hash of the time-limited OTP.
  const otp = crypto.randomInt(100000, 1000000).toString();

  user.resetPasswordOTP = hashOTP(otp);
  user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();
  return otp;
};

const verifyOTPService = async (email, otp) => {
  // Matching the hash and expiry prevents OTP reuse after timeout.
  const user = await User.findOne({
    email,
    resetPasswordOTP: hashOTP(otp),
    resetPasswordOTPExpires: { $gt: Date.now() },
  });

  if (!user) throw new AuthenticationError("Invalid or expired OTP");
  return { valid: true, userId: user._id };
};

const resetPasswordService = async (email, otp, newPassword) => {
  // Validate the OTP before changing the password.
  const user = await User.findOne({
    email,
    resetPasswordOTP: hashOTP(otp),
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

const logoutUserService = async (userId) => {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  user.refreshToken = null;
  await user.save();

  return user;
};

const getCurrentUserService = async (userId) => {
  if (!userId) throw new AuthenticationError("Unauthorized");

  const user = await User.findById(userId).select(
    "_id name email avatar role isVerified isActive",
  );

  if (!user) throw new AuthenticationError("User not found");

  return user;
};

const refreshAccessTokenService = async (token) => {
  if (!token) throw new AuthenticationError("Refresh token missing");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AuthenticationError("Refresh token expired or invalid");
  }

  // JWT validity is not enough; the token must still match the stored hash.
  const user = await User.findById(payload.userId);
  if (!user || !user.refreshToken) {
    throw new AuthenticationError("Invalid refresh token");
  }

  const isMatch = await bcrypt.compare(token, user.refreshToken);
  if (!isMatch) {
    throw new AuthenticationError("Invalid refresh token");
  }

  return user;
};

export {
  registerUserService,
  loginUserService,
  forgetPasswordService,
  verifyOTPService,
  resetPasswordService,
  logoutUserService,
  getCurrentUserService,
  refreshAccessTokenService,
};
