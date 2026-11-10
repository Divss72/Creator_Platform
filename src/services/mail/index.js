'use strict';

const env = require('../../config/env');
const logDriver = require('./logDriver');
const smtpDriver = require('./smtpDriver');

function getMailDriver() {
  const driverName = (env.MAIL_DRIVER || 'log').toLowerCase();
  switch (driverName) {
    case 'smtp':
      return smtpDriver;
    case 'log':
    default:
      return logDriver;
  }
}

module.exports = {
  getMailDriver,
  logDriver,
  smtpDriver
};

