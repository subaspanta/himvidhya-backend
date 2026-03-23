const canCreateClass = (user, context = {}) => {
  // Basic rule: must be teacher
  if (user.role !== "teacher") return false;

  // More attributes (you can add more later)
  if (!user.isVerified) return false; // example: must be verified
  // if (user.college !== 'TU') return false;         // example: only TU teachers

  return true;
};

const canJoinClass = (user, context = {}) => {
  // Anyone logged in can join (for now)
  return !!user;
};

const canViewClassDetails = (user, context = {}) => {
  // Must be member of the class
  const { classDoc } = context;
  if (!classDoc) return false;

  return classDoc.members.some(
    (m) => m.user.toString() === user._id.toString(),
  );
};
const canSendMessageInChannel = (user, context = {}) => {
  const { channel } = context;

  if (channel === "announcements") {
    // Only teachers & admins can post in announcements
    return ["teacher", "admin"].includes(user.role);
  }

  // Other channels: everyone
  return true;
};

module.exports = {
  canCreateClass,
  canJoinClass,
  canViewClassDetails,
  canSendMessageInChannel,
};
