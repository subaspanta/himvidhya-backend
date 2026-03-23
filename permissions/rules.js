const canCreateClass = (user, context = {}) => {
  if (user.role !== "teacher") return false;
  if (!user.isVerified) return false;
  return true;
};

const canJoinClass = (user, context = {}) => {
  return !!user;
};

const canViewClassDetails = (user, context = {}) => {
  const { classDoc } = context;
  if (!classDoc) return false;

  // req.auth uses userId, req.user uses _id — handle both
  const userId = (user.userId || user._id)?.toString();

  return classDoc.members.some((m) => m.user.toString() === userId);
};

const canSendMessageInChannel = (user, context = {}) => {
  const { channel } = context;

  if (channel === "announcements") {
    return ["teacher", "admin"].includes(user.role);
  }

  return true;
};

module.exports = {
  canCreateClass,
  canJoinClass,
  canViewClassDetails,
  canSendMessageInChannel,
};
