const winston = require("winston");

const logger = winston.createLogger({
  level: "info", // Set the logging level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(), // Log to the console
    new winston.transports.File({ filename: "logs/error.log", level: "error" }), // Log errors to a file
    new winston.transports.File({ filename: "logs/combined.log" }), // Log everything to a file
  ],
});

module.exports = { logger };
