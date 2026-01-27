import { generateToken } from "../config/jwt.js";
import { registerUser, loginUser } from "../services/auth.service.js";

export const register = async (req, res, next) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide all required fields",
      });
    }

    const { user } = await registerUser({
      name,
      email,
      username,
      password,
    });

    const token = generateToken(user._id);
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

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide email and password",
      });
    }
    const { user } = await loginUser({ email, password });

    const token = generateToken(user._id);
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
export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.json({ success: true, message: "Logged out successfully" });
};
