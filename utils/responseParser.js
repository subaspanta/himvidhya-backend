/**
 * Success response with data
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata (pagination, etc.)
 */
const successResponse = (
  res,
  data = null,
  message = "Success",
  statusCode = 200,
  meta = null,
) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Detailed error array (for validation errors)
 */
const errorResponse = (
  res,
  message = "An error occurred",
  statusCode = 500,
  errors = null,
) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors && Array.isArray(errors)) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 */
const createdResponse = (
  res,
  data,
  message = "Resource created successfully",
) => {
  return successResponse(res, data, message, 201);
};

/**
 * No content response (204)
 * @param {Object} res - Express response object
 */
const noContentResponse = (res) => {
  return res.status(204).send();
};

/**
 * Validation error response (422)
 * @param {Object} res - Express response object
 * @param {Array} errors - Array of validation errors
 */
const validationErrorResponse = (res, errors) => {
  return errorResponse(res, "Validation failed", 422, errors);
};

/**
 * Unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const unauthorizedResponse = (res, message = "Unauthorized") => {
  return errorResponse(res, message, 401);
};

/**
 * Forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const forbiddenResponse = (res, message = "Forbidden") => {
  return errorResponse(res, message, 403);
};

/**
 * Not found response (404)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const notFoundResponse = (res, message = "Resource not found") => {
  return errorResponse(res, message, 404);
};

/**
 * Conflict response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const conflictResponse = (res, message = "Resource already exists") => {
  return errorResponse(res, message, 409);
};

/**
 * Internal server error response (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const serverErrorResponse = (res, message = "Internal server error") => {
  return errorResponse(res, message, 500);
};

module.exports = {
  successResponse,
  errorResponse,
  createdResponse,
  noContentResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  serverErrorResponse,
};
