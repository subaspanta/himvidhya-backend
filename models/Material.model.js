import mongoose from "mongoose";

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
    storageKey: {
      type: String,
      required: true, // S3 object key, never exposed to clients
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

// Index for paginated material list queries
materialSchema.index({ classId: 1, createdAt: -1, _id: -1 });

export default mongoose.models.Material ||
  mongoose.model("Material", materialSchema);
