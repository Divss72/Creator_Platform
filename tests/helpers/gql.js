'use strict';

const http = require('http');
const { createTestApi } = require('./api');
const { attachGraphQL } = require('../../src/graphql');

/**
 * Creates an in-memory Apollo Server test runner bound to Supertest.
 *
 * @param {Object} [appOverrides={}]
 * @returns {Promise<{ app: express.Application, request: any, execute: Function, apolloServer: any, close: Function }>}
 */
async function createTestGql(appOverrides = {}) {
  const { app, request } = createTestApi(appOverrides);
  const httpServer = http.createServer(app);

  let apolloServer = null;
  if (app.graphqlRouter) {
    apolloServer = await attachGraphQL(app.graphqlRouter, httpServer);
  }

  async function execute(query, variables = {}, token = null) {
    let req = request.post('/graphql').send({ query, variables });
    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  }

  async function close() {
    if (apolloServer) {
      try {
        await apolloServer.stop();
      } catch (_err) {}
    }
  }

  return {
    app,
    request,
    execute,
    apolloServer,
    close
  };
}

module.exports = { createTestGql };

