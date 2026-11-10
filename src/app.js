'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { sequelize } = require('./models');
const env = require('./config/env');
const { corsOptions: defaultCorsOptions } = require('./config/cors');
const { globalLimiter } = require('./middleware/rateLimiters');

/**
 * Factory function creating an Express app instance with configurable options.
 * Has zero side-effects on import.
 *
 * @param {Object} [overrides={}]
 * @param {boolean} [overrides.rateLimitEnabled]
 * @param {Object} [overrides.corsOptions]
 * @param {number} [overrides.trustProxy]
 * @param {boolean} [overrides.isDev]
 * @returns {express.Application}
 */
function createApp(overrides = {}) {
  const app = express();

  const isDev = overrides.isDev !== undefined ? overrides.isDev : env.NODE_ENV === 'development';
  const rateLimitEnabled =
    overrides.rateLimitEnabled !== undefined ? overrides.rateLimitEnabled : env.RATE_LIMIT_ENABLED;
  const trustProxy = overrides.trustProxy !== undefined ? overrides.trustProxy : env.TRUST_PROXY;
  const corsOpts = overrides.corsOptions || defaultCorsOptions;

  // Disable X-Powered-By
  app.disable('x-powered-by');

  // Trust Proxy Configuration
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  } else {
    app.set('trust proxy', false);
  }

  // Helmet Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: isDev ? false : undefined,
      crossOriginEmbedderPolicy: isDev ? false : undefined
    })
  );

  // Unified CORS
  app.use(cors(corsOpts));

  // Request Body Limits (100kb on every route)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Global Rate Limiter (every route except /health and /version)
  if (rateLimitEnabled) {
    app.use(globalLimiter);
  }

  // Root health check endpoint - reports server status and db connectivity
  app.get('/health', async (_req, res) => {
    let dbStatus;
    try {
      await sequelize.authenticate();
      dbStatus = 'up';
    } catch (_err) {
      dbStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      db: dbStatus
    });
  });

  // Version endpoint: protected by DEPLOY_VERIFY_TOKEN in constant time
  app.get('/version', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!env.DEPLOY_VERIFY_TOKEN || !authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(404).send();
    }
    const token = authHeader.slice(7);
    const expected = Buffer.from(env.DEPLOY_VERIFY_TOKEN);
    const provided = Buffer.from(token);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return res.status(404).send();
    }
    res.status(200).json({
      version: env.APP_VERSION,
      commit: env.APP_COMMIT,
      builtAt: env.APP_BUILT_AT
    });
  });

  // Development-only test pages and mock storage hooks
  if (isDev) {
    app.get('/dev/chat', (_req, res) => {
      res.sendFile(path.resolve(__dirname, '..', 'public', 'dev-chat.html'));
    });

    app.get('/dev/upload', (_req, res) => {
      res.sendFile(path.resolve(__dirname, '..', 'public', 'dev-upload.html'));
    });

    // Expose fake storage inspect and failure test endpoints when fake driver is active
    if (env.STORAGE_DRIVER === 'fake') {
      app.get('/dev/storage', (_req, res) => {
        const storageDriver = require('./services/storage');
        res.json({
          driver: 'fake',
          registry: storageDriver.getRegistry ? storageDriver.getRegistry() : []
        });
      });

      app.post('/dev/storage/fail-next', (req, res) => {
        const { op } = req.body;
        const storageDriver = require('./services/storage');
        if (storageDriver.failNext) {
          storageDriver.failNext(op);
          return res.json({ status: 'ok', scheduledFailure: op });
        }
        res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Fake driver failure hook not available' }
        });
      });
    }

    // Dev Mail endpoints
    const { logDriver } = require('./services/mail');
    app.get('/dev/mail', (_req, res) => {
      res.json({
        driver: env.MAIL_DRIVER,
        sent: logDriver.getSent()
      });
    });

    app.get('/dev/mail/:id/html', (req, res) => {
      const sent = logDriver.getSent();
      const item = sent.find(
        (m) => m.messageId === req.params.id || m.messageId === `<${req.params.id}>`
      );
      if (!item || !item.html) {
        return res.status(404).send('Email or HTML preview not found');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(item.html);
    });

    app.post('/dev/mail/fail-next', (req, res) => {
      const count = parseInt(req.body.count, 10) || 1;
      logDriver.simulateFailNext(count);
      res.json({ status: 'ok', failNextCount: count });
    });

    app.post('/dev/mail/fail-all', (req, res) => {
      const fail = req.body.fail !== undefined ? Boolean(req.body.fail) : true;
      logDriver.simulateFailAll(fail);
      res.json({ status: 'ok', failAll: fail });
    });

    app.post('/dev/mail/clear', (_req, res) => {
      logDriver.clear();
      res.json({ status: 'ok', cleared: true });
    });

    // Dev Firebase endpoints
    const { fakeDriver } = require('./services/firebase');
    app.get('/dev/firebase', (_req, res) => {
      res.json({
        driver: env.FIREBASE_DRIVER,
        tree: fakeDriver.tree,
        writeCount: fakeDriver.getWriteCount()
      });
    });

    app.post('/dev/firebase/set', async (req, res) => {
      const { path: p, value } = req.body;
      if (!p) return res.status(400).json({ error: 'path required' });
      const result = await fakeDriver.set(p, value);
      res.json({ status: 'ok', result });
    });

    app.post('/dev/firebase/fail-next', (req, res) => {
      const count = parseInt(req.body.count, 10) || 1;
      fakeDriver.simulateFailNext(count);
      res.json({ status: 'ok', failNextCount: count });
    });

    app.post('/dev/firebase/fail-all', (req, res) => {
      const fail = req.body.fail !== undefined ? Boolean(req.body.fail) : true;
      fakeDriver.simulateFailAll(fail);
      res.json({ status: 'ok', failAll: fail });
    });

    app.post('/dev/firebase/clear', (_req, res) => {
      fakeDriver.clear();
      res.json({ status: 'ok', cleared: true });
    });
  }

  // Dedicated router for GraphQL mounted before 404 handler
  const graphqlRouter = express.Router();
  app.use('/graphql', graphqlRouter);
  app.graphqlRouter = graphqlRouter;

  // In development, hook query counter on REST API routes and set X-Debug-Query-Count header
  if (isDev) {
    const {
      queryCounterMiddleware,
      queryCounterStorage
    } = require('./graphql/plugins/queryCountPlugin');
    app.use('/api', queryCounterMiddleware, (req, res, next) => {
      const originalEnd = res.end;
      res.end = function (...args) {
        if (!res.headersSent && queryCounterStorage) {
          const storage = queryCounterStorage.getStore();
          if (storage && typeof storage.count === 'number') {
            res.setHeader('X-Debug-Query-Count', String(storage.count));
          }
        }
        return originalEnd.apply(this, args);
      };
      next();
    });
  }

  // API Routes
  app.use('/api', apiRoutes);

  // 404 handler
  app.use(notFound);

  // Central error handler
  app.use(errorHandler);

  return app;
}

const defaultApp = createApp();

module.exports = defaultApp;
module.exports.createApp = createApp;
module.exports.default = defaultApp;
