const { STATUS_CODES } = require("./status-codes");

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

class APIError extends BaseError {
  constructor(description = "Internal server error") {
    super("APIError", STATUS_CODES.INTERNAL_ERROR, description);
  }
}

class ValidationError extends BaseError {
  constructor(description = "Validation failed") {
    super("ValidationError", STATUS_CODES.BAD_REQUEST, description);
  }
}

class AuthorizeError extends BaseError {
  constructor(description = "Access denied") {
    super("AuthorizeError", STATUS_CODES.FORBIDDEN, description);
  }
}

class AuthenticationError extends BaseError {
  constructor(description = "Authentication required") {
    super("AuthenticationError", STATUS_CODES.UNAUTHORIZED, description);
  }
}

class NotFoundError extends BaseError {
  constructor(description = "Resource not found") {
    super("NotFoundError", STATUS_CODES.NOT_FOUND, description);
  }
}

class ConflictError extends BaseError {
  constructor(description = "Resource conflict") {
    super("ConflictError", STATUS_CODES.CONFLICT, description);
  }
}
const handleNotFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  BaseError,
  APIError,
  ValidationError,
  AuthorizeError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  handleNotFound,
};
