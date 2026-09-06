import { getCurrentUserService } from "../services/user.service.js";
import { successResponse } from "../utils/responseParser.js";
import asyncHandler from "../helpers/asyncHandler.js";

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await getCurrentUserService(req.auth.userId);

  return successResponse(res, { user }, "User retrieved successfully");
});

export { getCurrentUser };
