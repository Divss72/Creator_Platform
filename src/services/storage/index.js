'use strict';

const env = require('../../config/env');
const fakeDriver = require('./fakeDriver');
const cloudinaryDriver = require('./cloudinaryDriver');

if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'fake') {
  console.error('[Fatal Error] STORAGE_DRIVER cannot be "fake" in production mode.');
  process.exit(1);
}

const driver = env.STORAGE_DRIVER === 'cloudinary' ? cloudinaryDriver : fakeDriver;

module.exports = driver;
