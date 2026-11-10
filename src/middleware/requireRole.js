const ApiError = require('../utils/apiError');

/**
 * Middleware factory enforcing user role permissions
 * @param {...string} allowedRoles - 'creator' | 'subscriber'
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Access restricted to roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
};

module.exports = requireRole;
