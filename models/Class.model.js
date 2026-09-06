import mongoose from "mongoose";
import crypto from "crypto";

// Base36 alphabet -- keeps generated codes visually consistent with the
// previous Math.random().toString(36) output while sourcing each character
// from a CSPRNG.
const JOIN_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const JOIN_CODE_LENGTH = 8;

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      maxlength: [100, "Class name cannot exceed 100 characters"],
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [100],
    },
    joinCode: {
      type: String,
      required: [true, "Join code is required"],
      unique: true,
      trim: true,
      minlength: [6, "Join code must be at least 6 characters"],
      maxlength: [10, "Join code cannot exceed 10 characters"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500],
    },
    college: {
      type: String,
      trim: true,
    },
    semester: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "archived"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
classSchema.index({ joinCode: 1 }, { unique: true });
classSchema.index({ owner: 1 });
classSchema.index({ createdAt: -1 });

// Static Method: Generate unique join code
classSchema.statics.generateUniqueCode = async function () {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Array.from(
      { length: JOIN_CODE_LENGTH },
      () => JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)],
    ).join("");
    isUnique = !(await this.findOne({ joinCode: code }));
    attempts++;
  }

  if (!isUnique) {
    throw new Error(
      "Could not generate unique join code after multiple attempts",
    );
  }

  return code;
};

export default mongoose.model("Class", classSchema);
