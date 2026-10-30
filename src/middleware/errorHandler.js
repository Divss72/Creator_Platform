const { ZodError } = require('zod');
const {
  UniqueConstraintError,
  ValidationError,
  BaseError: SequelizeBaseError
} = require('sequelize');
const ApiError = require('../utils/apiError');

// Central error handler formatting all responses as { error: { code, message } }
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    const errorBody = {
      code: err.code,
      message: err.message
    };
    if (err.details !== undefined && err.details !== null) {
      errorBody.details = err.details;
    }
    return res.status(err.statusCode).json({
      error: errorBody
    });
  }

  // Zod request validation errors
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.') || 'field'}: ${e.message}`).join(', ');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message
      }
    });
  }

  // Sequelize unique constraint violation (e.g. duplicate email)
  if (err instanceof UniqueConstraintError) {
    const message = err.errors && err.errors.length > 0 ? err.errors[0].message : 'Resource already exists';
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message
      }
    });
  }

  // Sequelize model validation errors
  if (err instanceof ValidationError) {
    const message = err.errors.map((e) => e.message).join(', ');
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message
      }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: err.message || 'Invalid or expired authentication token'
      }
    });
  }

  // Malformed JSON payload
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload'
      }
    });
  }

  // Database error (generic Sequelize error): log internally, never leak SQL to client
  if (err instanceof SequelizeBaseError) {
    console.error('[Database Error]:', err.message);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'A database error occurred'
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
