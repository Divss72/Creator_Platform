const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const { userStore } = require('../store');

/**
 * Middleware supporting optional authentication:
 * - No authorization header provided -> continues as anonymous (req.user = null)
 * - Valid Bearer JWT -> attaches sanitized req.user and continues
 * - Malformed, invalid, or expired JWT -> returns 401 Unauthorized (does NOT silently fallback to anonymous)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.user = null;
      return next();
    }

    if (!authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token is malformed'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(ApiError.unauthorized('Authentication token is missing'));
    }

    const decoded = verifyToken(token);
    const user = await userStore.findById(decoded.sub);

    if (!user) {
      return next(ApiError.unauthorized('User associated with this token no longer exists'));
    }

    req.user = userStore.sanitize(user);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Invalid or expired authentication token'));
    }
    next(err);
  }
};

module.exports = optionalAuth;
