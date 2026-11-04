const { Server } = require('socket.io');
const env = require('../config/env');
const handshakeAuth = require('./auth');
const registerPostHandlers = require('./handlers/postHandler');
const registerCommentHandlers = require('./handlers/commentHandler');
const presence = require('./presence');
const rateLimiter = require('./rateLimiter');
const eventsFacade = require('./events');

let io = null;

/**
 * Initialize Socket.io on the shared HTTP server.
 * One port, one process.
 */
const initRealtime = (httpServer) => {
  const allowedOrigins =
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',').map((o) => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 16 * 1024 // 16 KB max payload size
  });

  // Attach io to facade so REST controllers can notify without importing socket.io
  eventsFacade.setIo(io);

  // Handshake authentication middleware
  io.use(handshakeAuth);

  io.on('connection', (socket) => {
    // Authenticated socket joins private user room "user:{id}"
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
    }

    // Register event handlers
    registerPostHandlers(io, socket);
    registerCommentHandlers(io, socket);

    // Clean up presence on disconnect (using disconnecting so socket.rooms is still available)
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
  });

  return io;
};

const getIo = () => io;

const closeRealtime = async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    io = null;
  }
};

module.exports = {
  initRealtime,
  getIo,
  closeRealtime
};
