const {
  NotFoundError,
  ValidationError,
  AuthorizeError,
  AuthenticationError,
} = require("./errors");
const { logger } = require("../../logger");

/**
 * Centralized Error Handler with Logger
 * Handles all errors thrown in the application
 * - Logs unexpected errors for monitoring
 * - Returns appropriate status codes and messages
 */
const HandleErrorWithLogger = (err, req, res, next) => {
  let reportError = true;
  let status = 500;
  let data = err.message || "Internal server error";

  // Check if error is a known/expected error type
  const knownErrors = [
    NotFoundError,
    ValidationError,
    AuthorizeError,
    AuthenticationError,
  ];

  knownErrors.forEach((ErrorType) => {
    if (err instanceof ErrorType) {
      reportError = false;
      status = err.status;
      data = err.message;
    }
  });

  if (reportError) {
    // Log unexpected errors for monitoring/debugging
    // Can integrate with error tracking tools like Sentry, CloudWatch, etc.
    logger.error({
      message: "Unexpected Error",
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    // Log known errors as warnings (user-caused errors)
    logger.warn({
      message: "Known Error",
      error: err.message,
      url: req.originalUrl,
      method: req.method,
    });
  }

  return res.status(status).json({
    status,
    error: data,
    message: data,
  });
};

/**
 * Handles uncaught exceptions
 * Logs the error and gracefully shuts down the process
 */
const HandleUnCaughtException = async (error) => {
  logger.error({
    message: "Uncaught Exception",
    error: error.message,
    stack: error.stack,
  });
  console.error("Uncaught Exception:", error);

  // Give time for logging to complete before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
};

/**
 * Handles unhandled promise rejections
 */
const HandleUnhandledRejection = async (reason, promise) => {
  logger.error({
    message: "Unhandled Promise Rejection",
    reason: reason,
    promise: promise,
  });
  console.error("Unhandled Promise Rejection:", reason);

  // Give time for logging to complete before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
};

module.exports = {
  HandleErrorWithLogger,
  HandleUnCaughtException,
  HandleUnhandledRejection,
};
