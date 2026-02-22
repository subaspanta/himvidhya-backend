const ROLE_PERMISSIONS = {
  admin: ["CREATE_CLASS", "DELETE_CLASS", "MANAGE_USERS", "SEND_MESSAGE"],
  teacher: ["CREATE_CLASS", "SEND_MESSAGE"],
  student: ["JOIN_CLASS", "SEND_MESSAGE"],
};

module.exports = { ROLE_PERMISSIONS };
