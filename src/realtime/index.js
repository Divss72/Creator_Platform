'use strict';

const { Server } = require('socket.io');
const env = require('../config/env');
const { isOriginAllowed } = require('../config/cors');
const handshakeAuth = require('./auth');
const registerPostHandlers = require('./handlers/postHandler');
const registerCommentHandlers = require('./handlers/commentHandler');
const presence = require('./presence');
const rateLimiter = require('./rateLimiter');
const eventsFacade = require('./events');
const { getClientIp } = require('../utils/ipExtractor');
const { RATE_LIMITS } = require('../config/limits');

let io = null;

// Track active socket connections per IP
const activeConnectionsByIp = new Map();

/**
 * Initialize Socket.io on the shared HTTP server.
 * One port, one process.
 */
const initRealtime = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS origin not allowed'));
        }
      },
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 16 * 1024 // 16 KB max payload size
  });

  // Attach io to facade so REST controllers can notify without importing socket.io
  eventsFacade.setIo(io);

  // Connection rate limiting middleware (max 20 concurrent connections per IP)
  io.use((socket, next) => {
    const ip = getClientIp(socket);
    socket.data.clientIp = ip;

    if (env.RATE_LIMIT_ENABLED || env.NODE_ENV === 'production') {
      const currentCount = activeConnectionsByIp.get(ip)?.size || 0;
      if (currentCount >= RATE_LIMITS.SOCKET_CONCURRENT_PER_IP) {
        const error = new Error('RATE_LIMITED');
        error.data = {
          code: 'RATE_LIMITED',
          message: 'Too many concurrent socket connections from this IP'
        };
        return next(error);
      }
    }

    return next();
  });

  // Handshake authentication middleware
  io.use(handshakeAuth);

  io.on('connection', (socket) => {
    const ip = socket.data.clientIp || getClientIp(socket);
    if (!activeConnectionsByIp.has(ip)) {
      activeConnectionsByIp.set(ip, new Set());
    }
    activeConnectionsByIp.get(ip).add(socket.id);

    // Authenticated socket joins private user room "user:{id}"
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
    }

    // Register event handlers
    registerPostHandlers(io, socket);
    registerCommentHandlers(io, socket);

    // Clean up presence and connection counts on disconnect
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('post:')) {
          const contentId = room.replace('post:', '');
          const { count, changed } = presence.removeViewer(contentId, socket);
          if (changed) {
            socket.to(room).emit('viewers:update', { contentId, count });
          }
        }
      }
      rateLimiter.cleanupSocket(socket.id);
    });

    socket.on('disconnect', () => {
      const connections = activeConnectionsByIp.get(ip);
      if (connections) {
        connections.delete(socket.id);
        if (connections.size === 0) {
          activeConnectionsByIp.delete(ip);
        }
      }
    });
  });

  return io;
};

const getIo = () => io;

const closeRealtime = async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    io = null;
    activeConnectionsByIp.clear();
  }
};

module.exports = {
  initRealtime,
  getIo,
  closeRealtime,
  _activeConnectionsByIp: activeConnectionsByIp
};
