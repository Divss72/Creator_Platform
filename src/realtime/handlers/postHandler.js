const contentStore = require('../../store/contentStore');
const accessService = require('../../services/accessService');
const presence = require('../presence');

const ROOM_LIMIT = 10;

const sendSuccess = (callback, data) => {
  if (typeof callback === 'function') {
    callback({ ok: true, data });
  }
};

const sendError = (callback, code, message, details = undefined) => {
  if (typeof callback === 'function') {
    const error = { code, message };
    if (details !== undefined && details !== null) {
      error.details = details;
    }
    callback({ ok: false, error });
  }
};

const registerPostHandlers = (io, socket) => {
  // Join a post chat room
  socket.on('post:join', async (payload, ack) => {
    try {
      if (!payload || !payload.contentId || typeof payload.contentId !== 'string') {
        return sendError(ack, 'VALIDATION_ERROR', 'contentId is required and must be a string');
      }

      const { contentId } = payload;
      if (!socket.data.joined) {
        socket.data.joined = new Map();
      }

      // 1. Idempotent join: already in the room
      if (socket.data.joined.has(contentId)) {
        const viewerCount = presence.getViewerCount(contentId);
        const canComment = Boolean(socket.data.user);
        return sendSuccess(ack, { contentId, viewerCount, canComment });
      }

      // 2. Room limit: max 10 rooms per socket
      if (socket.data.joined.size >= ROOM_LIMIT) {
        return sendError(ack, 'ROOM_LIMIT', 'Maximum 10 rooms per socket reached');
      }

      // 3. Load content
      const content = await contentStore.findById(contentId);
      if (!content) {
        return sendError(ack, 'NOT_FOUND', 'Content not found');
      }

      // 4. Resolve paywall access
      const access = await accessService.resolveAccess({
        viewer: socket.data.user,
        content
      });

      if (!access.hasAccess) {
        return sendError(ack, 'TIER_REQUIRED', 'Higher tier subscription required to access room', {
          requiredTier: access.requiredTier,
          viewerTier: access.viewerTier
        });
      }

      // 5. Join room and update presence
      socket.join(`post:${contentId}`);
      socket.data.joined.set(contentId, content.creatorId);

      const { count, changed } = presence.addViewer(contentId, socket);
      if (changed) {
        io.to(`post:${contentId}`).emit('viewers:update', { contentId, count });
      }

      const canComment = Boolean(socket.data.user);
      return sendSuccess(ack, { contentId, viewerCount: count, canComment });
    } catch (err) {
      console.error('[Socket post:join Error]:', err);
      return sendError(ack, 'INTERNAL_ERROR', 'An unexpected error occurred while joining room');
    }
  });

  // Leave a post chat room
  socket.on('post:leave', async (payload, ack) => {
    try {
      if (!payload || !payload.contentId || typeof payload.contentId !== 'string') {
        return sendError(ack, 'VALIDATION_ERROR', 'contentId is required and must be a string');
      }

      const { contentId } = payload;

      socket.leave(`post:${contentId}`);
      if (socket.data.joined) {
        socket.data.joined.delete(contentId);
      }

      const { count, changed } = presence.removeViewer(contentId, socket);
      if (changed) {
        io.to(`post:${contentId}`).emit('viewers:update', { contentId, count });
      }

      return sendSuccess(ack, { contentId });
    } catch (err) {
      console.error('[Socket post:leave Error]:', err);
      return sendError(ack, 'INTERNAL_ERROR', 'An unexpected error occurred while leaving room');
    }
  });
};

module.exports = registerPostHandlers;
