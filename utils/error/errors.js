const { STATUS_CODES } = require("./status-codes");

/**
 * Base Error Class
 * All custom errors extend from this base class
 */
class BaseError extends Error {
  constructor(name, status, description) {
    super(description);
    this.name = name;
    this.status = status;
    this.message = description;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/**
 * API Error - 500 Internal Server Error
 * Used for unexpected server errors
 */
class APIError extends BaseError {
  constructor(description = "Internal server error") {
    super("APIError", STATUS_CODES.INTERNAL_ERROR, description);
  }
}

/**
 * Validation Error - 400 Bad Request
 * Used for input validation failures
 */
class ValidationError extends BaseError {
  constructor(description = "Validation failed") {
    super("ValidationError", STATUS_CODES.BAD_REQUEST, description);
  }
}

/**
 * Authorization Error - 403 Forbidden
 * Used when user doesn't have permission to access resource
 */
class AuthorizeError extends BaseError {
  constructor(description = "Access denied") {
    super("AuthorizeError", STATUS_CODES.FORBIDDEN, description);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 * Used when user is not authenticated
 */
class AuthenticationError extends BaseError {
  constructor(description = "Authentication required") {
    super("AuthenticationError", STATUS_CODES.UNAUTHORIZED, description);
  }
}

/**
 * Not Found Error - 404 Not Found
 * Used when requested resource doesn't exist
 */
class NotFoundError extends BaseError {
  constructor(description = "Resource not found") {
    super("NotFoundError", STATUS_CODES.NOT_FOUND, description);
  }
}

/**
 * Conflict Error - 409 Conflict
 * Used when there's a conflict with existing data (e.g., duplicate entries)
 */
class ConflictError extends BaseError {
  constructor(description = "Resource conflict") {
    super("ConflictError", STATUS_CODES.CONFLICT, description);
  }
}

module.exports = {
  BaseError,
  APIError,
  ValidationError,
  AuthorizeError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
};
