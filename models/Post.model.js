import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Post content is required"],
      trim: true,
      maxlength: [10000, "Content cannot exceed 10000 characters"],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null, // Soft-delete: null = active, Date = deleted
    },
  },
  { timestamps: true },
);

// Index for pinned-first feed and pin count queries
postSchema.index({ classId: 1, isPinned: 1, createdAt: -1, _id: -1 });

export default mongoose.models.Post || mongoose.model("Post", postSchema);
