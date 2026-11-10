'use strict';

const env = require('../config/env');

/**
 * Resolves the client IP address based on TRUST_PROXY setting.
 * When TRUST_PROXY is 0 (off, default), X-Forwarded-For is strictly ignored.
 * When TRUST_PROXY > 0, reads the client IP from X-Forwarded-For header.
 *
 * @param {Object} req - Express request or Socket.io handshake object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  const headers = req.headers || (req.handshake && req.handshake.headers) || {};
  const remoteAddress =
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    (req.socket && req.socket.remoteAddress) ||
    (req.handshake && req.handshake.address) ||
    '127.0.0.1';

  if (env.TRUST_PROXY > 0 && headers['x-forwarded-for']) {
    const xForwardedFor = Array.isArray(headers['x-forwarded-for'])
      ? headers['x-forwarded-for'][0]
      : headers['x-forwarded-for'];

    const ips = xForwardedFor
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (ips.length > 0) {
      return ips[0];
    }
  }

  return remoteAddress;
}

module.exports = {
  getClientIp
};
