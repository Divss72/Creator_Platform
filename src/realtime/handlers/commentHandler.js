const commentService = require('../../services/commentService');
const { checkRateLimit } = require('../rateLimiter');
const ApiError = require('../../utils/apiError');

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

const registerCommentHandlers = (io, socket) => {
  socket.on('comment:create', async (payload, ack) => {
    try {
      // 1. Authentication check
      if (!socket.data.user) {
        return sendError(ack, 'UNAUTHENTICATED', 'Authentication required to post comments');
      }

      // 2. Token expiry check (mid-session expiration protection)
      if (socket.data.tokenExp && Date.now() / 1000 >= socket.data.tokenExp) {
        return sendError(ack, 'TOKEN_EXPIRED', 'Authentication token has expired. Please reconnect.');
      }

      // 3. Payload validation
      if (!payload || !payload.contentId || typeof payload.contentId !== 'string') {
        return sendError(ack, 'VALIDATION_ERROR', 'contentId is required and must be a string');
      }

      const { contentId, body } = payload;

      // 4. Room membership check: socket must have joined the room first
      if (!socket.data.joined || !socket.data.joined.has(contentId)) {
        return sendError(ack, 'NOT_IN_ROOM', 'Must join the post room before commenting');
      }

      // 5. Anti-spam rate limiting: max 5 comments per 10s per socket
      if (!checkRateLimit(socket.id)) {
        return sendError(ack, 'RATE_LIMITED', 'Rate limit exceeded: max 5 comments per 10 seconds');
      }

      // 6. Business logic & DB persistence via commentService (re-checks fresh DB access)
      const comment = await commentService.createComment({
        viewer: socket.data.user,
        contentId,
        body
      });

      // 7. Broadcast to WHOLE room including the sender (single render path, client dedupes by id)
      io.to(`post:${contentId}`).emit('comment:new', comment);

      // 8. Ack back to sender
      return sendSuccess(ack, { comment });
    } catch (err) {
      if (err instanceof ApiError) {
        return sendError(ack, err.code, err.message, err.details);
      }
      console.error('[Socket comment:create Error]:', err);
      return sendError(ack, 'INTERNAL_ERROR', 'An unexpected error occurred while posting comment');
    }
  });
};

module.exports = registerCommentHandlers;
