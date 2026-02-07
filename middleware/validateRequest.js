/**
 * Validation middleware for request body validation using Zod schemas
 * Usage: app.post("/route", validate(schema), handler)
 */
const { validationErrorResponse } = require("../utils/responseParser.js");

const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace body with validated data
      next();
    } catch (error) {
      if (error.name === "ZodError") {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return validationErrorResponse(res, formattedErrors);
      }
      next(error);
    }
  };
};

module.exports = validate;
