'use strict';

const fs = require('fs');
const admin = require('firebase-admin');
const env = require('../../config/env');

class FirebaseDriver {
  constructor() {
    this.app = null;
    this.db = null;
  }

  _init() {
    if (this.app) return;

    let credential;
    const rawKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (rawKey) {
      if (rawKey.trim().startsWith('{')) {
        credential = admin.credential.cert(JSON.parse(rawKey));
      } else if (fs.existsSync(rawKey)) {
        credential = admin.credential.cert(require(rawKey));
      }
    }

    if (!credential) {
      credential = admin.credential.applicationDefault();
    }

    this.app = admin.initializeApp({
      credential,
      databaseURL: env.FIREBASE_DATABASE_URL
    });

    this.db = admin.database(this.app);
  }

  async set(pathStr, value) {
    this._init();
    const ref = this.db.ref(pathStr);
    const toWrite = {
      ...value,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    };
    await ref.set(toWrite);
    return toWrite;
  }

  async get(pathStr) {
    this._init();
    const snapshot = await this.db.ref(pathStr).once('value');
    return snapshot.val();
  }

  async delete(pathStr) {
    this._init();
    await this.db.ref(pathStr).remove();
  }

  async createCustomToken(uid, claims = {}) {
    this._init();
    return admin.auth(this.app).createCustomToken(uid, claims);
  }
}

module.exports = new FirebaseDriver();
