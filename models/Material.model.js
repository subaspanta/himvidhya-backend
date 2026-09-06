import mongoose from "mongoose";

// Metadata only -- file bytes live in S3-compatible object storage,
// transferred by presigned URL (ADR-0005). Unlike Post/Comment, Material
// deletion is a HARD delete: Domain Model §3.7 requires the metadata
// record AND the stored object to be removed together, with no
// undelete/tombstone concept for files.
const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Material title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    size: {
      type: Number,
      required: [true, "Size is required"],
      min: [1, "Size must be greater than 0"],
    },
    // Object key in the bucket. Never serialized to a client-facing
    // response -- presigned URLs are the only access path (ADR-0005).
    storageKey: {
      type: String,
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Serves the material list pagination query.
materialSchema.index({ classId: 1, createdAt: -1, _id: -1 });

export default mongoose.model("Material", materialSchema);
