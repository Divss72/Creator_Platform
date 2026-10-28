const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const { userStore } = require('../store');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Authentication token is missing');
    }

    const decoded = verifyToken(token);
    const user = await userStore.findById(decoded.sub);

    if (!user) {
      throw ApiError.unauthorized('User associated with this token no longer exists');
    }

    // Attach sanitized user to request context
    req.user = userStore.sanitize(user);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Invalid or expired authentication token'));
    }
    next(err);
  }
};

module.exports = requireAuth;
