import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

commentSchema.index({ postId: 1, createdAt: 1, _id: 1 });

export default mongoose.models.Comment ||
  mongoose.model("Comment", commentSchema);
