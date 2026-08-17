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

// Use ValidationError for schema/input validation failures (e.g., missing required fields, invalid format)
class ValidationError extends BaseError {
  constructor(description = "Validation failed") {
    super("ValidationError", STATUS_CODES.BAD_REQUEST, description);
  }
}

// Use BadRequestError for malformed requests or invalid operations (e.g., invalid request syntax, cannot process)
class BadRequestError extends BaseError {
  constructor(description = "Bad request") {
    super("BadRequestError", STATUS_CODES.BAD_REQUEST, description);
  }
}

// Use AuthorizeError for authenticated users lacking permissions (e.g., student trying to access admin route)
class AuthorizeError extends BaseError {
  constructor(description = "Access denied") {
    super("AuthorizeError", STATUS_CODES.FORBIDDEN, description);
  }
}

// Use ForbiddenError when access is prohibited regardless of authentication (e.g., banned user, blocked resource)
class ForbiddenError extends BaseError {
  constructor(description = "Forbidden") {
    super("ForbiddenError", STATUS_CODES.FORBIDDEN, description);
  }
}

// Use AuthenticationError when user credentials are missing or invalid (e.g., no token, invalid login)
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

// Use UnprocessableEntityError for well-formed input that is semantically
// invalid outside Zod body validation (e.g. an opaque pagination cursor
// that doesn't decode) -- distinct from ValidationError (400): this is a
// well-formed request the server still can't act on, not a malformed one.
class UnprocessableEntityError extends BaseError {
  constructor(description = "Unprocessable entity") {
    super(
      "UnprocessableEntityError",
      STATUS_CODES.UNPROCESSABLE_ENTITY,
      description,
    );
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
  BadRequestError,
  AuthorizeError,
  ForbiddenError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  handleNotFound,
};
