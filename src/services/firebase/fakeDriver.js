'use strict';

const crypto = require('crypto');

class FakeFirebaseDriver {
  constructor() {
    this.tree = {};
    this.writeCount = 0;
    this.failNextCount = 0;
    this.failAll = false;
  }

  /**
   * Clear in-memory database and counters
   */
  clear() {
    this.tree = {};
    this.writeCount = 0;
    this.failNextCount = 0;
    this.failAll = false;
  }

  /**
   * Simulate transient failure for next N writes
   */
  simulateFailNext(count = 1) {
    this.failNextCount = Math.max(0, count);
  }

  /**
   * Simulate failure for all subsequent writes
   */
  simulateFailAll(fail = true) {
    this.failAll = Boolean(fail);
  }

  getWriteCount() {
    return this.writeCount;
  }

  _checkFailure() {
    if (this.failAll) {
      throw new Error('Simulated Firebase error (fail-all)');
    }
    if (this.failNextCount > 0) {
      this.failNextCount--;
      throw new Error('Simulated Firebase error (fail-next)');
    }
  }

  _traverse(pathStr, createParents = false) {
    const segments = pathStr.split('/').filter(Boolean);
    let current = this.tree;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (current[seg] === undefined || current[seg] === null) {
        if (createParents) {
          current[seg] = {};
        } else {
          return { parent: null, lastKey: null };
        }
      }
      current = current[seg];
    }

    const lastKey = segments.length > 0 ? segments[segments.length - 1] : null;
    return { parent: current, lastKey };
  }

  /**
   * Set value at path.
   * Resolves ServerValue.TIMESTAMP to current epoch milliseconds.
   */
  async set(pathStr, value) {
    this._checkFailure();

    // Deep clone value
    let cloned = JSON.parse(JSON.stringify(value));
    if (cloned && typeof cloned === 'object') {
      if (cloned.updatedAt === '.sv_timestamp' || cloned.updatedAt === undefined) {
        cloned.updatedAt = Date.now();
      }
    }

    const { parent, lastKey } = this._traverse(pathStr, true);
    if (lastKey) {
      parent[lastKey] = cloned;
    } else {
      this.tree = cloned;
    }

    this.writeCount++;
    return cloned;
  }

  /**
   * Read value at path
   */
  async get(pathStr) {
    this._checkFailure();
    const { parent, lastKey } = this._traverse(pathStr, false);
    if (!parent || !lastKey || parent[lastKey] === undefined) {
      return null;
    }
    return JSON.parse(JSON.stringify(parent[lastKey]));
  }

  /**
   * Delete node at path
   */
  async delete(pathStr) {
    this._checkFailure();
    const { parent, lastKey } = this._traverse(pathStr, false);
    if (parent && lastKey && parent[lastKey] !== undefined) {
      delete parent[lastKey];
      this.writeCount++;
    }
  }

  /**
   * Mint a mock custom auth token
   */
  async createCustomToken(uid, claims = {}) {
    this._checkFailure();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        uid,
        claims,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', 'fake-firebase-secret')
      .update(`${header}.${payload}`)
      .digest('base64url');
    return `${header}.${payload}.${sig}`;
  }
}

module.exports = new FakeFirebaseDriver();
