/**
 * API Versioning Configuration
 * This file defines the current API version and provides utilities for version management
 */

const API_VERSION = {
  CURRENT: "v1",
  SUPPORTED: ["v1"],
  PREFIX: "/api",
};

/**
 * Get the full versioned API path
 * @param {string} version - API version (default: current)
 * @returns {string} - Full API path with version
 */
const getVersionedPath = (version = API_VERSION.CURRENT) => {
  return `${API_VERSION.PREFIX}/${version}`;
};

/**
 * Check if a version is supported
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
