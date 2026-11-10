'use strict';

process.env.NODE_ENV = 'test';
if (!process.env.DB_NAME_TEST) {
  process.env.DB_NAME_TEST = 'creatorhub_test';
}
process.env.DB_NAME = process.env.DB_NAME_TEST;

const dbName = process.env.DB_NAME;
if (!dbName.endsWith('_test') || process.env.NODE_ENV !== 'test') {
  throw new Error(
    `FATAL: Tests may only run when NODE_ENV=test and the database name ends with '_test' (current DB: "${dbName}", NODE_ENV: "${process.env.NODE_ENV}")`
  );
}

// Ensure default timeout for asynchronous tests
jest.setTimeout(15000);

// Ensure domain event listeners are registered for integration test lifecycles
const { registerDomainListeners } = require('../../src/events/listeners');
registerDomainListeners();

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  try {
    const { sequelize } = require('../../src/models');
    await sequelize.close();
  } catch (_err) {}
});
