// Utility functions for common operations

export const formatResponse = (success, data, message = "") => {
  return {
    success,
    data,
    message,
  };
};

export const getPaginationParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};
