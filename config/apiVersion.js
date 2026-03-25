const API_VERSION = {
  CURRENT: "v1",
  SUPPORTED: ["v1"],
  PREFIX: "/api",
};

/**
 * @param {string} version
 * @returns {string}
 */
const getVersionedPath = (version = API_VERSION.CURRENT) => {
  return `${API_VERSION.PREFIX}/${version}`;
};

/**
 * @param {string} version
 * @returns {boolean}
 */
const isVersionSupported = (version) => {
  return API_VERSION.SUPPORTED.includes(version);
};

module.exports = {
  API_VERSION,
  getVersionedPath,
  isVersionSupported,
};
