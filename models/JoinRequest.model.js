import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["request", "invite"],
      default: "request",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Fetch all pending requests for a class
joinRequestSchema.index({ class: 1, status: 1 });
// Fetch a student's pending requests
joinRequestSchema.index({ user: 1, status: 1 });
// Check if a request already exists from this user for this class
joinRequestSchema.index({ class: 1, user: 1 });

export default mongoose.models.JoinRequest ||
  mongoose.model("JoinRequest", joinRequestSchema);
