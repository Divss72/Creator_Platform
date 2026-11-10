'use strict';

const { sequelize } = require('../../src/models');

module.exports = async function globalTeardown() {
  try {
    await sequelize.close();
  } catch (_err) {}
};
