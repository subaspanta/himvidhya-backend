const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["teacher", "moderator", "student"],
      default: "student",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }, // No separate _id for embedded documents
);

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      maxLength: [100, "Class name cann't exceed 100 characters"],
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
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500],
    },
  },
  {
    timestamps: true,
  },
);

classSchema.index({ joinCode: 1 }, { unique: true });
classSchema.index({ creator: 1 });
classSchema.index({ "members.user": 1 });
classSchema.index({ createdAt: -1 });

classSchema.pre("save", async function (next) {
  if (this.isNew) {
    // When creating a new class, automatically add creator as teacher
    this.members.push({
      user: this.creator,
      role: "teacher",
      joinedAt: new Date(),
    });
  }
  next();
});

// Instance method: Check if a user is member
classSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString(),
  );
};

// Instance method: Get user's role in this class
classSchema.methods.getUserRole = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString(),
  );
  return member ? member.role : null;
};

// Static method: Generate unique join code
classSchema.statics.generateUniqueCode = async function () {
  let code;
  let isUnique = false;
  const attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase(); // 8 chars
    isUnique = !(await this.findOne({ joinCode: code }));
  }

  if (!isUnique) {
    throw new Error(
      "Could not generate unique join code after multiple attempts",
    );
  }

  return code;
};

module.exports = mongoose.model("Class", classSchema);
