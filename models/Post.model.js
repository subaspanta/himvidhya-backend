const mongoose = require("mongoose");

// Attachment subdocument: three kinds the composer can attach. storageKey
// (file only) never leaves the server -- stripped before serialization by
// post.service.js's stripAttachments (attachmentStorage.service.js).
const postAttachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["file", "link", "youtube"],
      required: true,
    },
    url: { type: String, trim: true }, // link + youtube
    fileName: { type: String, trim: true }, // file
    mimeType: { type: String }, // file
    size: { type: Number }, // file
    storageKey: { type: String }, // file -- stripped before serialization
    thumbnailUrl: { type: String }, // youtube, derived server-side
  },
  { _id: true },
);

// D4 (superseded): file attachments now use the shared presigned-upload
// storage client (ADR-0005, attachmentStorage.service.js) via the same
// presign-PUT/verify flow -- see requestPostAttachmentUploadUrlService/
// resolveAttachmentsForSave in post.service.js. D3: content is plain text
// -- the server stores/returns
// it as an opaque string with no sanitization or markdown/HTML
// interpretation; "renders as plain text" is a client rendering guarantee,
// out of scope here.
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
    // I7: soft-delete marker. null = live. Set once by deletePostService,
    // never unset -- there is no undelete endpoint.
    deletedAt: {
      type: Date,
      default: null,
    },
    attachments: {
      type: [postAttachmentSchema],
      default: [],
    },
  },
  { timestamps: true },
);

// Serves both the pinned-first feed query (GET /classes/:classId/posts)
// and the I5 pinned-count check in pinPostService
// ({ classId, isPinned: true, deletedAt: null }).
postSchema.index({ classId: 1, isPinned: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("Post", postSchema);
