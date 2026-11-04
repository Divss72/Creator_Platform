const ApiError = require('../utils/apiError');

const KNOWN_CODES = new Set([
  'UNAUTHENTICATED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'NOT_FOUND',
  'TIER_REQUIRED',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED'
]);

/**
 * Apollo Server error formatter.
 * Maps ApiError to uniform GraphQLError shape and prevents SQL/stack trace leakage.
 *
 * @param {Object} formattedError Formatted error produced by Apollo
 * @param {Error} error Original error instance
 * @returns {Object} Sanitized error object for client response
 */
const formatError = (formattedError, error) => {
  const originalError = error && error.originalError ? error.originalError : error;

  // 1. ApiError mapping (from service / resolver throw)
  if (originalError instanceof ApiError) {
    const extensions = {
      code: originalError.code || 'INTERNAL_ERROR'
    };

    if (originalError.details) {
      extensions.details = originalError.details;
    }

    return {
      message: originalError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions
    };
  }

  // 2. Preserve Apollo syntax and schema validation errors
  const code = formattedError.extensions && formattedError.extensions.code;
  if (code && KNOWN_CODES.has(code)) {
    const extensions = {
      code
    };
    if (formattedError.extensions.details) {
      extensions.details = formattedError.extensions.details;
    }
    return {
      message: formattedError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions
    };
  }

  // 3. Map BAD_USER_INPUT to VALIDATION_ERROR
  if (code === 'BAD_USER_INPUT') {
    return {
      message: formattedError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: {
        code: 'VALIDATION_ERROR'
      }
    };
  }

  // 4. Unexpected server error (log internally, never leak SQL or stack trace)
  console.error('[GraphQL Internal Error]', originalError || error);

  return {
    message: 'Internal server error',
    locations: formattedError.locations,
    path: formattedError.path,
    extensions: {
      code: 'INTERNAL_ERROR'
    }
  };
};

module.exports = {
  formatError
};
