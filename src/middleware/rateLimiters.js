'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { RATE_LIMITS } = require('../config/limits');
const { getClientIp } = require('../utils/ipExtractor');

// TODO(scale): Swap in-memory rate limiting store for ioredis-backed cluster store

/**
 * Standard 429 response handler conforming to CreatorHub error format.
 */
const rateLimitHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', retryAfterSeconds);

  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
      details: {
        retryAfterSeconds
      }
    }
  });
};

const createLimiter = (options) => {
  return rateLimit({
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: rateLimitHandler,
    validate: false, // Disable automatic IPv6 / header validation warnings
    keyGenerator: (req) => getClientIp(req),
    ...options,
    skip: (req) => {
      if (!env.RATE_LIMIT_ENABLED && env.NODE_ENV !== 'production') {
        return true;
      }
      if (typeof options.skip === 'function') {
        return options.skip(req);
      }
      return false;
    }
  });
};

// 1. Global rate limiter: 120 requests / 1 min per IP (except /health)
const globalLimiter = createLimiter({
  windowMs: RATE_LIMITS.GLOBAL.WINDOW_MS,
  max: RATE_LIMITS.GLOBAL.MAX_REQUESTS,
  skip: (req) => req.path === '/health'
});

// 2. Auth register limiter: 5 registrations / 1 hr per IP
const authRegisterLimiter = createLimiter({
  windowMs: RATE_LIMITS.AUTH_REGISTER.WINDOW_MS,
  max: RATE_LIMITS.AUTH_REGISTER.MAX_REQUESTS
});

// 3. Auth login limiter: 10 FAILED attempts / 15 mins per IP (successful logins not counted)
const authLoginLimiter = createLimiter({
  windowMs: RATE_LIMITS.AUTH_LOGIN.WINDOW_MS,
  max: env.NODE_ENV === 'development' ? 200 : RATE_LIMITS.AUTH_LOGIN.MAX_FAILED_ATTEMPTS,
  skipSuccessfulRequests: true
});

// 4. User writes limiter: 60 writes / 15 mins per user ID (fallback to IP)
const userWritesLimiter = createLimiter({
  windowMs: RATE_LIMITS.USER_WRITES.WINDOW_MS,
  max: RATE_LIMITS.USER_WRITES.MAX_REQUESTS,
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : getClientIp(req))
});

// 5. Media & avatar uploads limiter: 20 uploads / 1 hr per user ID (fallback to IP)
const mediaUploadLimiter = createLimiter({
  windowMs: RATE_LIMITS.MEDIA_UPLOAD.WINDOW_MS,
  max: RATE_LIMITS.MEDIA_UPLOAD.MAX_REQUESTS,
  keyGenerator: (req) =>
    req.user && req.user.id ? `upload:${req.user.id}` : `upload:${getClientIp(req)}`
});

// 6. GraphQL rate limiter: 60 requests / 1 min per IP
const graphqlLimiter = createLimiter({
  windowMs: RATE_LIMITS.GRAPHQL.WINDOW_MS,
  max: RATE_LIMITS.GRAPHQL.MAX_REQUESTS
});

// 7. Unsubscribe limiter: 30 requests / 1 hr per IP
const unsubscribeLimiter = createLimiter({
  windowMs: RATE_LIMITS.UNSUBSCRIBE.WINDOW_MS,
  max: RATE_LIMITS.UNSUBSCRIBE.MAX_REQUESTS
});

// 8. Firebase custom token minting limiter: 10 requests / 15 mins per user ID
const firebaseTokenLimiter = createLimiter({
  windowMs: RATE_LIMITS.FIREBASE_TOKEN.WINDOW_MS,
  max: RATE_LIMITS.FIREBASE_TOKEN.MAX_REQUESTS,
  keyGenerator: (req) =>
    req.user && req.user.id ? `fb_token:${req.user.id}` : `fb_token:${getClientIp(req)}`
});

// 9. View recording limiter: 120 requests / 1 min per IP
const viewLimiter = createLimiter({
  windowMs: RATE_LIMITS.VIEWS.WINDOW_MS,
  max: RATE_LIMITS.VIEWS.MAX_REQUESTS,
  keyGenerator: (req) => `views:${getClientIp(req)}`
});

// 10. Analytics read limiter: 60 requests / 1 min per user ID
const analyticsReadLimiter = createLimiter({
  windowMs: RATE_LIMITS.ANALYTICS_READ.WINDOW_MS,
  max: RATE_LIMITS.ANALYTICS_READ.MAX_REQUESTS,
  keyGenerator: (req) =>
    req.user && req.user.id ? `analytics:${req.user.id}` : `analytics:${getClientIp(req)}`
});

module.exports = {
  globalLimiter,
  authRegisterLimiter,
  authLoginLimiter,
  userWritesLimiter,
  mediaUploadLimiter,
  graphqlLimiter,
  unsubscribeLimiter,
  firebaseTokenLimiter,
  viewLimiter,
  analyticsReadLimiter
};
