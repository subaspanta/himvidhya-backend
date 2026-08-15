const fs = require("fs");
const path = require("path");
const {
  NotFoundError,
  ValidationError,
  AuthorizeError,
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} = require("./errors");
const { logger } = require("../../logger");

const fallbackLog = (err) => {
  try {
    fs.appendFileSync(
      path.join(__dirname, "../../logs/fatal.log"),
      `${new Date().toISOString()} | ${err.message}\n${err.stack}\n\n`,
    );
  } catch {}
};

/* ---------------- EXPRESS ERROR MIDDLEWARE ---------------- */

const HandleErrorWithLogger = (err, req, res, next) => {
  let reportError = true;
  let status = 500;
  let message = err.message || "Internal server error";

  const knownErrors = [
    NotFoundError,
    ValidationError,
    AuthorizeError,
    AuthenticationError,
    BadRequestError,
    ForbiddenError,
    ConflictError,
  ];

  knownErrors.forEach((ErrorType) => {
    if (err instanceof ErrorType) {
      reportError = false;
      status = err.status;
    }
  });

  if (reportError) {
    logger.error("Unexpected API Error", {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user?.id || "guest",
      body: req.body,
      params: req.params,
      query: req.query,
    });
  } else {
    logger.warn("Handled Application Error", {
      error: err.message,
      method: req.method,
      url: req.originalUrl,
      user: req.auth?.userId || "guest",
    });
  }

  res.status(status).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

/* ---------------- GLOBAL CRASH HANDLERS ---------------- */

const HandleUnCaughtException = (error) => {
  try {
    logger.error("Uncaught Exception", {
      message: error.message,
      stack: error.stack,
    });
  } catch {
    fallbackLog(error);
  }
  process.exit(1);
};

const HandleUnhandledRejection = (reason) => {
  try {
    logger.error("Unhandled Promise Rejection", {
      message: reason?.message || reason,
      stack: reason?.stack,
    });
  } catch {
    fallbackLog(reason);
  }
  process.exit(1);
};

module.exports = {
  HandleErrorWithLogger,
  HandleUnCaughtException,
  HandleUnhandledRejection,
};
