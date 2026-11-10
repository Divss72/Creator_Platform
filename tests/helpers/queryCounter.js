'use strict';

const { sequelize } = require('../../src/models');

/**
 * Attaches a direct Sequelize query counter hook for asserting O(1) query complexity.
 */
function trackQueries() {
  let count = 0;
  const queries = [];

  const hook = (options) => {
    count++;
    if (typeof options === 'string') {
      queries.push(options);
    } else if (options && options.query) {
      queries.push(options.query);
    }
  };

  sequelize.addHook('afterQuery', hook);

  return {
    getCount: () => count,
    getQueries: () => [...queries],
    reset: () => {
      count = 0;
      queries.length = 0;
    },
    stop: () => {
      sequelize.removeHook('afterQuery', hook);
    }
  };
}

async function countQueries(fn) {
  const tracker = trackQueries();
  try {
    const result = await fn();
    return { result, queryCount: tracker.getCount(), queries: tracker.getQueries() };
  } finally {
    tracker.stop();
  }
}

module.exports = { trackQueries, countQueries };

