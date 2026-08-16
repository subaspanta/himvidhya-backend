const { getCurrentUserService } = require("../services/user.service.js");
const { successResponse } = require("../utils/responseParser.js");
const asyncHandler = require("../helpers/asyncHandler.js");

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await getCurrentUserService(req.auth.userId);

  return successResponse(res, { user }, "User retrieved successfully");
});

module.exports = {
  getCurrentUser,
};
