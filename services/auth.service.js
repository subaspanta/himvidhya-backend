import User from "../models/User.js";
import { generateToken } from "../config/jwt.js";

export const registerUser = async ({ name, email, username, password }) => {
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

export const loginUser = async ({ email, password }) => {
  // Find user by email
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
