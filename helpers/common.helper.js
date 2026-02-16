const formatResponse = (success, data, message = "") => {
  return {
    success,
    data,
    message,
  };
};

const getPaginationParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = {
  formatResponse,
  getPaginationParams,
};
