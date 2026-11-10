const { verifyToken } = require('../utils/jwt');
const userStore = require('../store/userStore');

/**
 * Socket.io handshake authentication middleware.
 * Transport: io(url, { auth: { token } })
 * Query string tokens are explicitly rejected.
 */
const handshakeAuth = async (socket, next) => {
  try {
    // 1. Explicitly ignore/reject tokens passed in query string to prevent leak into logs
    if (socket.handshake.query && socket.handshake.query.token) {
      delete socket.handshake.query.token;
    }

    const token = socket.handshake.auth && socket.handshake.auth.token;

    // 2. Anonymous connection
    if (!token) {
      socket.data.user = null;
      socket.data.tokenExp = null;
      socket.data.joined = new Map(); // contentId -> creatorId
      return next();
    }

    // 3. Authenticated connection
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('TOKEN_EXPIRED'));
      }
      return next(new Error('INVALID_TOKEN'));
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return next(new Error('INVALID_TOKEN'));
    }

    // Load user from DB once at connect time to confirm they still exist
    const user = await userStore.findById(userId);
    if (!user) {
      return next(new Error('INVALID_TOKEN'));
    }

    // Allow-list the fields kept on the socket
    socket.data.user = {
      id: user.id,
      role: user.role,
      name: user.name
    };
    socket.data.tokenExp = decoded.exp || null;
    socket.data.joined = new Map(); // contentId -> creatorId

    return next();
  } catch (error) {
    return next(new Error('INVALID_TOKEN'));
  }
};

module.exports = handshakeAuth;
