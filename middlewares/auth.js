const AppError = require("../utils/AppError");

/**
 * isAuthenticated — guards routes that require a logged-in user.
 * Passport sets req.isAuthenticated() when a valid session exists.
 */
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  next(new AppError("Authentication required. Please log in.", 401));
};

module.exports = { isAuthenticated };
