'use strict';

const env = require('./env');

/**
 * Unified CORS Configuration
 * Single implementation shared across REST, GraphQL, and Socket.io.
 */

const rawOrigin = env.CORS_ORIGIN || '*';
const allowedOrigins = rawOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  // Allow requests without Origin header (Postman, curl, server-to-server)
  if (!origin) return true;

  // Wildcard is allowed ONLY in non-production environments
  if (env.NODE_ENV !== 'production' && allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  exposedHeaders: ['X-Debug-Query-Count', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  credentials: false, // We use Bearer tokens, not cookies
  maxAge: 600 // 10 minutes preflight cache
};

module.exports = {
  corsOptions,
  isOriginAllowed
};
