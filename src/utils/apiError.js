'use strict';

class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new ApiError(400, code, message, details);
  }

  static validation(message, details = null) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static tierRequired(message = 'Higher tier subscription required', details = null) {
    return new ApiError(403, 'TIER_REQUIRED', message, details);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static mediaLimit(message = 'Media attachment limit reached (maximum 5 attachments per post)', details = null) {
    return new ApiError(409, 'MEDIA_LIMIT', message, details);
  }

  static quotaExceeded(message = 'Storage quota exceeded', details = null) {
    return new ApiError(403, 'QUOTA_EXCEEDED', message, details);
  }

  static payloadTooLarge(message = 'Payload too large', details = null) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', message, details);
  }

  static unsupportedMediaType(message = 'Unsupported media type', details = null) {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message, details);
  }

  static uploadFailed(message = 'Upload failed, please try again later', details = null) {
    return new ApiError(502, 'UPLOAD_FAILED', message, details);
  }

  static rateLimited(message = 'Too many requests, please try again later', details = null) {
    return new ApiError(429, 'RATE_LIMITED', message, details);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}

module.exports = ApiError;
