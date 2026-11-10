const { AsyncLocalStorage } = require('node:async_hooks');
const { sequelize } = require('../../models');

const queryCounterStorage = new AsyncLocalStorage();
let hookInitialized = false;

/**
 * Initializes the Sequelize hook for query counting in development mode.
 */
const initQueryCounterHook = () => {
  if (hookInitialized || process.env.NODE_ENV !== 'development') {
    return;
  }
  sequelize.addHook('beforeQuery', () => {
    const store = queryCounterStorage.getStore();
    if (store) {
      store.count++;
    }
  });
  hookInitialized = true;
};

/**
 * Express middleware to create an isolated AsyncLocalStorage scope for each request.
 */
const queryCounterMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }
  initQueryCounterHook();
  queryCounterStorage.run({ count: 0 }, () => {
    next();
  });
};

/**
 * Apollo Server plugin to inject queryCount into response extensions in development mode only.
 */
const queryCountPlugin = {
  async requestDidStart() {
    if (process.env.NODE_ENV !== 'development') {
      return {};
    }

    return {
      async willSendResponse(requestContext) {
        const store = queryCounterStorage.getStore();
        if (!store || process.env.NODE_ENV !== 'development') {
          return;
        }

        const responseBody = requestContext.response.body;
        if (responseBody && responseBody.kind === 'single' && responseBody.singleResult) {
          if (!responseBody.singleResult.extensions) {
            responseBody.singleResult.extensions = {};
          }
          responseBody.singleResult.extensions.queryCount = store.count;
        }
      }
    };
  }
};

module.exports = {
  queryCounterStorage,
  queryCounterMiddleware,
  queryCountPlugin
};
