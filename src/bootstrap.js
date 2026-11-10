'use strict';

const http = require('http');
const { createApp } = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const { initRealtime, closeRealtime } = require('./realtime');
const { attachGraphQL } = require('./graphql');
const { registerDomainListeners } = require('./events/listeners');
const { startJobs, stopJobs } = require('./jobs');

/**
 * Bootstrap the full application lifecycle:
 * Database verification -> Domain Listeners -> App -> HTTP -> Sockets -> Apollo -> Jobs.
 *
 * @param {Object} [options={}]
 * @param {number} [options.port=env.PORT]
 * @param {boolean} [options.jobs=env.JOBS_ENABLED]
 * @param {boolean} [options.dbConnect=true]
 * @param {Object} [options.appOverrides={}]
 * @returns {Promise<{ app: express.Application, httpServer: http.Server, io: any, apolloServer: any, port: number, close: Function }>}
 */
async function bootstrap({
  port = env.PORT,
  jobs = env.JOBS_ENABLED,
  dbConnect = true,
  appOverrides = {}
} = {}) {
  if (dbConnect) {
    try {
      await sequelize.authenticate();
      if (env.LOG_LEVEL !== 'silent' && env.NODE_ENV !== 'test') {
        console.log('[CreatorHub] Database connection verified successfully.');
      }
    } catch (error) {
      if (env.LOG_LEVEL !== 'silent') {
        console.error('\n================================================================');
        console.error('[CreatorHub] FATAL: Unable to connect to MySQL database!');
        console.error(
          `Config: host=${env.DB_HOST}, port=${env.DB_PORT}, db=${env.DB_NAME}, user=${env.DB_USER}`
        );
        console.error(`Reason: ${error.message}`);
        console.error('================================================================\n');
      }
      throw error;
    }
  }

  // Register domain event listeners
  registerDomainListeners();

  // Create Express application
  const app = createApp(appOverrides);

  // Create HTTP server and attach realtime Sockets
  const httpServer = http.createServer(app);
  const io = initRealtime(httpServer);

  // Attach Apollo GraphQL server to app's dedicated graphqlRouter
  let apolloServer = null;
  if (app.graphqlRouter) {
    apolloServer = await attachGraphQL(app.graphqlRouter, httpServer);
  }

  // Start background jobs if enabled
  if (jobs) {
    startJobs();
  }

  let actualPort = port;
  if (port !== undefined && port !== null) {
    await new Promise((resolve) => {
      httpServer.listen(port, () => {
        const addr = httpServer.address();
        actualPort = typeof addr === 'object' && addr ? addr.port : port;
        if (env.LOG_LEVEL !== 'silent' && env.NODE_ENV !== 'test') {
          console.log(
            `[CreatorHub] API server listening on port ${actualPort} in ${env.NODE_ENV} mode`
          );
        }
        resolve();
      });
    });
  }

  let isClosed = false;

  /**
   * Gracefully close all server resources in documented order:
   * 1. Socket.io connections & server
   * 2. Apollo GraphQL server drain
   * 3. Background jobs / intervals
   * 4. HTTP Server
   * 5. Database connection pool
   */
  async function close() {
    if (isClosed) return;
    isClosed = true;

    // 1. Socket.io
    try {
      await closeRealtime();
    } catch (_err) {}

    // 2. Apollo Server
    if (apolloServer) {
      try {
        await apolloServer.stop();
      } catch (_err) {}
    }

    // 3. Background jobs
    if (jobs) {
      try {
        await stopJobs();
      } catch (_err) {}
    }

    // 4. HTTP Server
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });

    // 5. Database Connection
    if (dbConnect) {
      try {
        await sequelize.close();
      } catch (_err) {}
    }
  }

  return {
    app,
    httpServer,
    io,
    apolloServer,
    port: actualPort,
    close
  };
}

module.exports = { bootstrap };

