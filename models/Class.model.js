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
      enum: ["teacher", "student"],
      default: "student",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

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
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [memberSchema],
      default: [],
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
    maxStudents: {
      type: Number,
      default: 50,
      min: [5, "Minimum 5 students per batch"],
    },
    // Removed attendanceRate since you removed the bar from UI
    nextDeadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "archived"],
    },
    isVerified: {
      type: Boolean,
      default: false, // Admin can verify batch
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
classSchema.index({ joinCode: 1 }, { unique: true });
classSchema.index({ creator: 1 });
classSchema.index({ "members.user": 1 }); // Fast lookup for user's classes
classSchema.index({ createdAt: -1 });

// Pre-save hook: Auto-add creator as teacher
classSchema.pre("save", function (next) {
  if (this.isNew && this.creator) {
    // Only add if creator is not already in members
    const alreadyMember = this.members.some(
      (m) => m.user.toString() === this.creator.toString(),
    );
    if (!alreadyMember) {
      this.members.unshift({
        user: this.creator,
        role: "teacher",
        joinedAt: new Date(),
      });
    }
  }
  next();
});

// Instance Methods
classSchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString(),
  );
};

classSchema.methods.getUserRole = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString(),
  );
  return member ? member.role : null;
};

// Static Method: Generate unique join code
classSchema.statics.generateUniqueCode = async function () {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
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

module.exports = mongoose.model("Class", classSchema);
