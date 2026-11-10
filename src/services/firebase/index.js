'use strict';

const env = require('../../config/env');
const fakeDriver = require('./fakeDriver');
const firebaseDriver = require('./firebaseDriver');

function getFirebaseDriver() {
  const driver = (env.FIREBASE_DRIVER || 'fake').toLowerCase();
  switch (driver) {
    case 'firebase':
      return firebaseDriver;
    case 'fake':
    default:
      return fakeDriver;
  }
}

module.exports = {
  getFirebaseDriver,
  fakeDriver,
  firebaseDriver
};
