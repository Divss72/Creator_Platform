'use strict';

const env = require('../config/env');
const { subscriptionStore } = require('../store');
const { getFirebaseDriver } = require('./firebase');

class FirebaseSyncService {
  constructor() {
    this.debounceTimers = new Map();
  }

  /**
   * Flush and clear all pending debounced sync operations.
   */
  async flushDebouncedSyncs() {
    const creatorIds = Array.from(this.debounceTimers.keys());
    for (const creatorId of creatorIds) {
      const timer = this.debounceTimers.get(creatorId);
      if (timer) clearTimeout(timer);
      this.debounceTimers.delete(creatorId);
      await this._executeSync(creatorId);
    }
  }

  /**
   * Cancel all pending debounced sync timers without executing.
   */
  cancelAllSyncs() {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Request synchronization of live subscriber metrics for a creator.
   * Debounced to coalesce rapid subscription changes.
   *
   * @param {string} creatorId
   * @param {Object} [options]
   * @param {boolean} [options.immediate=false]
   */
  async syncCreatorMetrics(creatorId, { immediate = false } = {}) {
    if (!creatorId) return;

    if (immediate) {
      if (this.debounceTimers.has(creatorId)) {
        clearTimeout(this.debounceTimers.get(creatorId));
        this.debounceTimers.delete(creatorId);
      }
      return this._executeSync(creatorId);
    }

    // Debounce
    if (this.debounceTimers.has(creatorId)) {
      clearTimeout(this.debounceTimers.get(creatorId));
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(creatorId);
        try {
          await this._executeSync(creatorId);
        } finally {
          resolve();
        }
      }, env.FIREBASE_SYNC_DEBOUNCE_MS);

      this.debounceTimers.set(creatorId, timer);
    });
  }

  /**
   * Execute sync with exponential backoff retries.
   * Side-effect isolation: Never throws or fails callers.
   */
  async _executeSync(creatorId) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const metrics = await subscriptionStore.countActiveByCreatorGroupedByTier(creatorId);
        const payload = {
          subscriberCount: metrics.total,
          byTier: metrics.byTier,
          updatedAt: Date.now()
        };

        const driver = getFirebaseDriver();
        await driver.set(`creatorStats/${creatorId}`, payload);
        return payload;
      } catch (err) {
        if (attempt >= maxRetries) {
          console.error(
            `[FirebaseSync] Failed to sync creator ${creatorId} after ${maxRetries} attempts:`,
            err.message
          );
          return null;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
  }
}

module.exports = new FirebaseSyncService();
