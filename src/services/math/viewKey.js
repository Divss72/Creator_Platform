'use strict';

const crypto = require('crypto');

/**
 * Generates an irreversible, privacy-preserving HMAC-SHA256 deduplication key.
 * Rotates daily by incorporating the UTC date directly into the hash input.
 *
 * @param {Object} params
 * @param {string} params.secret Secret HMAC key (min 32 chars in production)
 * @param {string} params.day Formatted UTC date string (YYYY-MM-DD)
 * @param {string} [params.userId] Optional authenticated user ID
 * @param {string} [params.ip] Client IP address (used only if unauthenticated)
 * @param {string} [params.userAgent] Client User-Agent header (used only if unauthenticated)
 * @returns {string} 64-character lowercase hex string
 */
function generateViewerKey({ secret, day, userId, ip, userAgent }) {
  if (!secret) {
    throw new Error('secret is required for viewer key generation');
  }
  if (!day) {
    throw new Error('day (YYYY-MM-DD) is required for viewer key generation');
  }

  let identity;
  if (userId) {
    identity = `u:${userId}`;
  } else {
    const rawIp = (ip || '127.0.0.1').trim();
    const rawUa = (userAgent || '').trim();
    identity = `anon:${rawIp}|${rawUa}`;
  }

  const payload = `${day}|${identity}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

module.exports = { generateViewerKey };
