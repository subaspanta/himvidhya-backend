import mongoose from "mongoose";

// Student-only membership. The class owner is never a ClassMember document —
// ownership is read from Class.owner.
const classMemberSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "left", "removed"],
      default: "active",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// One membership row per (class, user); rejoining reactivates it.
classMemberSchema.index({ classId: 1, userId: 1 }, { unique: true });
// A user's classes
classMemberSchema.index({ userId: 1, status: 1 });
// A class's roster
classMemberSchema.index({ classId: 1, status: 1 });

export default mongoose.model("ClassMember", classMemberSchema);
