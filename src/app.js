'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { sequelize } = require('./models');
const env = require('./config/env');
const { corsOptions } = require('./config/cors');
const { globalLimiter } = require('./middleware/rateLimiters');
const { queryCounterMiddleware } = require('./graphql/plugins/queryCountPlugin');

const app = express();

// Disable X-Powered-By
app.disable('x-powered-by');

// Trust Proxy Configuration
if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
} else {
  app.set('trust proxy', false);
}

// Helmet Security Headers
const isDev = env.NODE_ENV === 'development';
app.use(
  helmet({
    contentSecurityPolicy: isDev ? false : undefined,
    crossOriginEmbedderPolicy: isDev ? false : undefined
  })
);

// Unified CORS
app.use(cors(corsOptions));

// Request Body Limits (100kb on every route)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global Rate Limiter (every route except /health)
app.use(globalLimiter);

// Root health check endpoint - reports server status and db connectivity
app.get('/health', async (req, res) => {
  let dbStatus = 'down';
  try {
    await sequelize.authenticate();
    dbStatus = 'up';
  } catch (err) {
    dbStatus = 'down';
  }

  res.status(200).json({
    status: 'ok',
    db: dbStatus
  });
});

// Development-only test pages and mock storage hooks
if (isDev) {
  app.get('/dev/chat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'public', 'dev-chat.html'));
  });

  app.get('/dev/upload', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'public', 'dev-upload.html'));
  });

  // Expose fake storage inspect and failure test endpoints when fake driver is active
  if (env.STORAGE_DRIVER === 'fake') {
    app.get('/dev/storage', (req, res) => {
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
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Fake driver failure hook not available' } });
    });
  }
}

// Dedicated router for GraphQL mounted before 404 handler
const graphqlRouter = express.Router();
app.use('/graphql', graphqlRouter);
app.graphqlRouter = graphqlRouter;

// In development, hook query counter on REST API routes and set X-Debug-Query-Count header
if (isDev) {
  const { queryCounterMiddleware, queryCounterStorage } = require('./graphql/plugins/queryCountPlugin');
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

module.exports = app;
