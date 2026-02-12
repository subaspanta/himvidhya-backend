const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "logs");

const readableFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message} ${metaString}`;
  }),
);

const logger = winston.createLogger({
  level: "info",

  transports: [
    // Console (dev friendly)
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), readableFormat),
    }),

    // Errors file
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: readableFormat,
    }),

    // All logs file
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: readableFormat,
    }),
  ],

  // Auto-handle crashes at logger level
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
    }),
  ],
});

module.exports = { logger };
