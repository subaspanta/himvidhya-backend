const PASSWORD_RULES = {
  minLength: 8,
  mustInclude: {
    uppercase: {
      description: "At least one uppercase letter (A-Z)",
      regex: /[A-Z]/,
      message: "Password must include an uppercase letter",
    },
    number: {
      description: "At least one number (0-9)",
      regex: /[0-9]/,
      message: "Password must include a number",
    },
    symbol: {
      description: "At least one special character (!@#$%^&*)",
      regex: /[^A-Za-z0-9]/,
      message: "Password must include a special character",
    },
  },
};

// For API response (frontend display)
const getPasswordRequirements = () => ({
  minLength: PASSWORD_RULES.minLength,
  mustInclude: {
    uppercase: PASSWORD_RULES.mustInclude.uppercase.description,
    number: PASSWORD_RULES.mustInclude.number.description,
    symbol: PASSWORD_RULES.mustInclude.symbol.description,
  },
  description: "Password must meet all requirements above",
});

module.exports = {
  PASSWORD_RULES,
  getPasswordRequirements,
};
