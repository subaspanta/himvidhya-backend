const User = require("../models/User.js");
const { generateToken } = require("../config/jwt.js");
const crypto = require("crypto");

const registerUserService = async ({ name, email, username, password }) => {
  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email }, ...(username ? [{ username }] : [])],
  });

  if (existingUser) {
    throw new Error("Email or username already exists");
  }

  // Create user (password will be hashed by the pre-save hook)
  const user = await User.create({
    name,
    email,
    username,
    passwordHash: password,
  });

  // Generate JWT token
  const token = generateToken(user._id);

  return { user, token };
};
const loginUserService = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  // Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // Generate JWT token
  const token = generateToken(user._id);

  return { user, token };
};

const forgetPasswordService = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return;

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  await user.save();
  return resetToken;
};

const resetPasswordService = async (token, newPassword) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) throw new Error("Token invalid or expired");
  user.passwordHash = newPassword; // pre-save hook hashes
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  return true;
};

module.exports = {
  registerUserService,
  loginUserService,
  forgetPasswordService,
  resetPasswordService,
};
