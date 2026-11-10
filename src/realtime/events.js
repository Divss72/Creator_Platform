const contentStore = require('../store/contentStore');
const accessService = require('../services/accessService');
const presence = require('./presence');

let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

/**
 * Revalidate all open sockets for a user when their subscription status changes
 * (subscribe, upgrade, downgrade, cancel).
 * Safe no-op when Socket.io is not initialized; never throws.
 */
const onSubscriptionChanged = async ({ userId, creatorId }) => {
  try {
    if (!ioInstance || !userId) return;

    const userRoom = ioInstance.sockets.adapter.rooms.get(`user:${userId}`);
    if (!userRoom) return;

    for (const socketId of Array.from(userRoom)) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (!socket || !socket.data.joined) continue;

      for (const [contentId, postCreatorId] of Array.from(socket.data.joined.entries())) {
        if (postCreatorId === creatorId) {
          const content = await contentStore.findById(contentId);
          let hasAccess = false;

          if (content) {
            const access = await accessService.resolveAccess({
              viewer: socket.data.user,
              content
            });
            hasAccess = access.hasAccess;
          }

          if (!hasAccess) {
            socket.leave(`post:${contentId}`);
            socket.data.joined.delete(contentId);

            const { count, changed } = presence.removeViewer(contentId, socket);
            if (changed) {
              ioInstance.to(`post:${contentId}`).emit('viewers:update', { contentId, count });
            }

            socket.emit('access:revoked', {
              contentId,
              reason: 'SUBSCRIPTION_CHANGED'
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Realtime Facade Error onSubscriptionChanged]:', err.message);
  }
};

/**
 * Revalidate all sockets currently in a post room when the post is updated (e.g. minTier raised).
 * Safe no-op when Socket.io is not initialized; never throws.
 */
const onContentUpdated = async ({ contentId }) => {
  try {
    if (!ioInstance || !contentId) return;

    const content = await contentStore.findById(contentId);
    if (!content) return;

    const postRoom = ioInstance.sockets.adapter.rooms.get(`post:${contentId}`);
    if (!postRoom) return;

    const socketIds = Array.from(postRoom);
    for (const socketId of socketIds) {
      const socket = ioInstance.sockets.sockets.get(socketId);
      if (!socket) continue;

      const access = await accessService.resolveAccess({
        viewer: socket.data.user,
        content
      });

      if (!access.hasAccess) {
        socket.leave(`post:${contentId}`);
        if (socket.data.joined) {
          socket.data.joined.delete(contentId);
        }

        const { count, changed } = presence.removeViewer(contentId, socket);
        if (changed) {
          ioInstance.to(`post:${contentId}`).emit('viewers:update', { contentId, count });
        }

        socket.emit('access:revoked', {
          contentId,
          reason: 'TIER_REQUIREMENT_CHANGED'
        });
      }
    }
  } catch (err) {
    console.error('[Realtime Facade Error onContentUpdated]:', err.message);
  }
};

/**
 * Broadcast post:deleted to room, then kick all sockets out and clear presence.
 * Safe no-op when Socket.io is not initialized; never throws.
 */
const onContentDeleted = async ({ contentId }) => {
  try {
    if (!ioInstance || !contentId) return;

    // 1. Emit post:deleted to everyone in the room
    ioInstance.to(`post:${contentId}`).emit('post:deleted', { contentId });

    // 2. Remove all sockets from the room
    const postRoom = ioInstance.sockets.adapter.rooms.get(`post:${contentId}`);
    if (postRoom) {
      const socketIds = Array.from(postRoom);
      for (const socketId of socketIds) {
        const socket = ioInstance.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(`post:${contentId}`);
          if (socket.data.joined) {
            socket.data.joined.delete(contentId);
          }
        }
      }
    }

    // 3. Clear distinct presence memory
    presence.clearRoom(contentId);
  } catch (err) {
    console.error('[Realtime Facade Error onContentDeleted]:', err.message);
  }
};

module.exports = {
  setIo,
  onSubscriptionChanged,
  onContentUpdated,
  onContentDeleted
};
