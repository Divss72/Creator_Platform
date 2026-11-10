'use strict';

const { io } = require('socket.io-client');

/**
 * Connect a test Socket.io client to an ephemeral port.
 *
 * @param {number} port
 * @param {Object} [options]
 * @param {string|null} [options.token=null]
 * @param {string[]} [options.transports=['websocket']]
 * @returns {import('socket.io-client').Socket}
 */
function createSocketClient(port, { token = null, transports = ['websocket'] } = {}) {
  const url = `http://localhost:${port}`;
  const options = {
    transports,
    autoConnect: true,
    forceNew: true,
    reconnection: false
  };

  if (token) {
    options.auth = { token };
  }

  return io(url, options);
}

module.exports = { createSocketClient };

