import mongoose from "mongoose";

// Flat comments only (Domain Model §3.6 — no parent reference, no nesting).
// No classId field: the owning class is always reached via postId -> Post.classId,
// same indirection Post itself uses for nothing since it IS the class-scoped
// entity. Comment mirrors Post's own shape deliberately (postId/authorId/
// content/deletedAt/timestamps) rather than denormalizing classId, per the
// Domain Model's exact field list.
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
    // Soft-delete marker, same convention as Post.model.js: null = live,
    // set once, never unset — no undelete endpoint.
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Comments read oldest-first (API Contract §5.1/D6 — explicit "Load more",
// not a reverse-chron feed), so the compound sort is ascending, unlike Post's.
commentSchema.index({ postId: 1, createdAt: 1, _id: 1 });

export default mongoose.model("Comment", commentSchema);
