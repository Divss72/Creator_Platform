/**
 * Distinct viewer presence tracker.
 *
 * Structure: Map<contentId, Map<viewerKey, Set<socketId>>>
 * - viewerKey = userId for authenticated sockets, socketId for anonymous sockets.
 * - Single user with multiple tabs/sockets is counted ONCE.
 * - Sockets count down only when their last socket leaves.
 * - Viewer count is NOT stored in the database.
 *
 * Single-process only.
 * TODO(scale): Redis adapter for multi-instance deployments. Do not build it now.
 */

const presence = new Map();

/**
 * Resolve viewer key for distinct counting
 */
const getViewerKey = (socket) => {
  return socket.data && socket.data.user ? socket.data.user.id : socket.id;
};

/**
 * Get distinct viewer count for a content room
 */
const getViewerCount = (contentId) => {
  const roomPresence = presence.get(contentId);
  return roomPresence ? roomPresence.size : 0;
};

/**
 * Add socket to presence for contentId.
 * Returns { count, changed: boolean }
 */
const addViewer = (contentId, socket) => {
  let roomPresence = presence.get(contentId);
  if (!roomPresence) {
    roomPresence = new Map();
    presence.set(contentId, roomPresence);
  }

  const oldCount = roomPresence.size;
  const viewerKey = getViewerKey(socket);

  let socketSet = roomPresence.get(viewerKey);
  if (!socketSet) {
    socketSet = new Set();
    roomPresence.set(viewerKey, socketSet);
  }
  socketSet.add(socket.id);

  const newCount = roomPresence.size;
  return {
    count: newCount,
    changed: oldCount !== newCount
  };
};

/**
 * Remove socket from presence for contentId.
 * Returns { count, changed: boolean }
 */
const removeViewer = (contentId, socket) => {
  const roomPresence = presence.get(contentId);
  if (!roomPresence) {
    return { count: 0, changed: false };
  }

  const oldCount = roomPresence.size;
  const viewerKey = getViewerKey(socket);

  const socketSet = roomPresence.get(viewerKey);
  if (socketSet) {
    socketSet.delete(socket.id);
    if (socketSet.size === 0) {
      roomPresence.delete(viewerKey);
    }
  }

  if (roomPresence.size === 0) {
    presence.delete(contentId);
  }

  const newCount = roomPresence.size;
  return {
    count: newCount,
    changed: oldCount !== newCount
  };
};

/**
 * Clear all presence for a room (e.g. on post deletion)
 */
const clearRoom = (contentId) => {
  presence.delete(contentId);
};

module.exports = {
  getViewerCount,
  addViewer,
  removeViewer,
  clearRoom
};
