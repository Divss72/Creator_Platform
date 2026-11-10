'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');

/**
 * Build Supertest request instance against an isolated createApp() without binding a network port.
 *
 * @param {Object} [overrides={}]
 * @returns {{ app: express.Application, request: request.SuperTest<request.Test> }}
 */
function createTestApi(overrides = {}) {
  const app = createApp({
    rateLimitEnabled: false,
    ...overrides
  });

  return {
    app,
    request: request(app)
  };
}

module.exports = { createTestApi };

