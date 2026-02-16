const API_VERSION = {
  CURRENT: "v1",
  SUPPORTED: ["v1"],
  PREFIX: "/api",
};

/**
 * @param {string} version - API version (default: current)
 * @returns {string} - Full API path with version
 */
const getVersionedPath = (version = API_VERSION.CURRENT) => {
  return `${API_VERSION.PREFIX}/${version}`;
};

/**
 * @param {string} version - API version to check
 * @returns {boolean} - Whether the version is supported
 */
const isVersionSupported = (version) => {
  return API_VERSION.SUPPORTED.includes(version);
};

module.exports = {
  API_VERSION,
  getVersionedPath,
  isVersionSupported,
};
