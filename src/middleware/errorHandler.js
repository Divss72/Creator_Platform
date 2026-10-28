const { ZodError } = require('zod');
const ApiError = require('../utils/apiError');

// Central error handler formatting all responses as { error: { code, message } }
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.') || 'field'}: ${e.message}`).join(', ');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message
      }
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: err.message || 'Invalid or expired authentication token'
      }
    });
  }

  // Handle syntax error (e.g. malformed JSON in request body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload'
      }
    });
  }

  // Log unhandled exceptions in development
  console.error('[Unhandled Exception]:', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred'
    }
  });
};

module.exports = errorHandler;
