// PRD §7.6 / Domain Model I10: allowed file types and the 25 MB cap.
// Shared by the upload-url validation, the replace-url validation, and the
// client's own pre-check -- server-side is the enforced boundary either way.

const MAX_MATERIAL_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", // .pdf
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "image/png", // .png
  "image/jpeg", // .jpg, .jpeg
]);

export { MAX_MATERIAL_SIZE_BYTES, ALLOWED_MIME_TYPES };
