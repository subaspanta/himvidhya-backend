const { ROLE_PERMISSIONS } = require("../config/rbac.js");

function getPermissionsFromRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { getPermissionsFromRole };
