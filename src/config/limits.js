'use strict';

/**
 * Platform Limits & Quotas
 * Single source of truth for rate limiting, file sizes, text lengths, and cost controls.
 */
module.exports = {
  // Rate limits
  RATE_LIMITS: {
    GLOBAL: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 120
    },
    AUTH_REGISTER: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 5
    },
    AUTH_LOGIN: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_FAILED_ATTEMPTS: 10
    },
    USER_WRITES: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 60
    },
    MEDIA_UPLOAD: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 20
    },
    GRAPHQL: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 60
    },
    SOCKET_CONCURRENT_PER_IP: 20,
    SOCKET_COMMENT_BURST: {
      WINDOW_MS: 10 * 1000, // 10 seconds
      MAX_COMMENTS: 5
    }
  },

  // GraphQL Cost Controls
  GRAPHQL_COST: {
    MAX_DEPTH: 6,
    MAX_ROOT_FIELDS: 10
  },

  // Media File Limits (in bytes)
  MEDIA: {
    MAX_IMAGE_BYTES: parseInt(process.env.MEDIA_MAX_IMAGE_BYTES || '5242880', 10), // 5 MB
    MAX_VIDEO_BYTES: parseInt(process.env.MEDIA_MAX_VIDEO_BYTES || '52428800', 10), // 50 MB
    MAX_AVATAR_BYTES: parseInt(process.env.AVATAR_MAX_BYTES || '2097152', 10), // 2 MB
    MAX_PER_POST: parseInt(process.env.MEDIA_MAX_PER_POST || '5', 10), // 5 attachments
    QUOTA_BYTES_PER_CREATOR: parseInt(process.env.MEDIA_QUOTA_BYTES_PER_CREATOR || '209715200', 10) // 200 MB
  },

  // Text Length Limits
  TEXT: {
    TITLE_MAX_LENGTH: 200,
    NAME_MAX_LENGTH: 100,
    DISPLAY_NAME_MAX_LENGTH: 60,
    BIO_MAX_LENGTH: 500,
    COMMENT_MAX_LENGTH: 1000,
    ORIGINAL_NAME_MAX_LENGTH: 150,
    RICH_TEXT_BODY_MAX_LENGTH: 100000
  },

  // Allowed Media MIME Types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm']
};
