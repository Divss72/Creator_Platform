/**
 * In-memory sliding window rate limiter for Socket.io events.
 * Rule: max 5 comment:create per 10 seconds per socket.
 */

const socketHistory = new Map(); // socketId -> Array<number>

const MAX_COMMENTS = 5;
const WINDOW_MS = 10 * 1000; // 10 seconds

/**
 * Checks if a socket is within rate limits.
 * Returns true if allowed, false if rate limited.
 */
const checkRateLimit = (socketId) => {
  const now = Date.now();
  let timestamps = socketHistory.get(socketId);

  if (!timestamps) {
    timestamps = [];
    socketHistory.set(socketId, timestamps);
  }

  // Retain only timestamps within the rolling window
  timestamps = timestamps.filter((t) => now - t < WINDOW_MS);
  socketHistory.set(socketId, timestamps);

  if (timestamps.length >= MAX_COMMENTS) {
    return false;
  }

  timestamps.push(now);
  return true;
};

/**
 * Clean up memory when socket disconnects
 */
const cleanupSocket = (socketId) => {
  socketHistory.delete(socketId);
};

module.exports = {
  checkRateLimit,
  cleanupSocket
};
