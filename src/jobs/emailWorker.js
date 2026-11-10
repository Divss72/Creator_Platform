'use strict';

const env = require('../config/env');
const { outboxStore } = require('../store');
const { processOutboxRow } = require('../services/outboxService');

class EmailWorker {
  constructor({ now, driver, batchSize = env.EMAIL_WORKER_BATCH_SIZE } = {}) {
    this.isRunning = false;
    this.pollTimer = null;
    this.reclaimTimer = null;
    this.currentBatchPromise = null;
    this.nowFn = typeof now === 'function' ? now : () => (now instanceof Date ? now : new Date());
    this.driver = driver || null;
    this.batchSize = batchSize;
  }

  /**
   * Process a single batch immediately without timers.
   * Useful for deterministic testing and manual runs.
   *
   * @param {Object} [options]
   * @param {Date} [options.now]
   * @param {number} [options.batchSize]
   * @returns {Promise<{ processed: number, rows: Array }>}
   */
  async runOnce({ now, batchSize = this.batchSize } = {}) {
    const effectiveNow = now || this.nowFn();
    const rows = await outboxStore.claimDueRows({
      batchSize,
      now: effectiveNow
    });

    if (!rows || rows.length === 0) {
      return { processed: 0, rows: [] };
    }

    for (const row of rows) {
      await processOutboxRow(row, { now: effectiveNow, driver: this.driver });
    }

    return { processed: rows.length, rows };
  }

  /**
   * Start the background email worker with intervals
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (env.LOG_LEVEL !== 'silent' && env.NODE_ENV !== 'test') {
      console.log('[EmailWorker] Started outbox processing worker.');
    }

    // Immediate initial poll
    this.scheduleNextPoll(100);

    // Periodic stuck row recovery every 60 seconds
    this.reclaimTimer = setInterval(async () => {
      try {
        const reclaimed = await outboxStore.reclaimStuckRows(5 * 60 * 1000);
        if (reclaimed > 0 && env.LOG_LEVEL !== 'silent' && env.NODE_ENV !== 'test') {
          console.log(`[EmailWorker] Reclaimed ${reclaimed} stuck outbox rows.`);
        }
      } catch (err) {
        if (env.LOG_LEVEL !== 'silent') {
          console.error('[EmailWorker] Error reclaiming stuck rows:', err.message);
        }
      }
    }, 60 * 1000);
  }

  /**
   * Schedule next poll iteration
   */
  scheduleNextPoll(delayMs = env.EMAIL_WORKER_POLL_MS) {
    if (!this.isRunning) return;
    this.pollTimer = setTimeout(async () => {
      await this.poll();
    }, delayMs);
  }

  /**
   * Execute a single poll cycle
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      this.currentBatchPromise = this.processBatch();
      await this.currentBatchPromise;
    } catch (err) {
      if (env.LOG_LEVEL !== 'silent') {
        console.error('[EmailWorker] Error during batch processing:', err.message);
      }
    } finally {
      this.currentBatchPromise = null;
      if (this.isRunning) {
        this.scheduleNextPoll();
      }
    }
  }

  /**
   * Fetch and process one batch of due outbox items
   */
  async processBatch() {
    const { processed } = await this.runOnce();
    const intervalMs = Math.max(10, Math.floor(1000 / env.EMAIL_RATE_LIMIT_PER_SEC));

    if (processed > 0 && intervalMs > 0 && this.isRunning) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return processed;
  }

  /**
   * Graceful shutdown: stops scheduling and waits for in-flight batch
   */
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.reclaimTimer) {
      clearInterval(this.reclaimTimer);
      this.reclaimTimer = null;
    }

    if (this.currentBatchPromise) {
      try {
        await this.currentBatchPromise;
      } catch (_err) {}
    }

    if (env.LOG_LEVEL !== 'silent' && env.NODE_ENV !== 'test') {
      console.log('[EmailWorker] Stopped outbox processing worker.');
    }
  }
}

function createEmailWorker(options = {}) {
  return new EmailWorker(options);
}

const defaultEmailWorker = createEmailWorker();

module.exports = defaultEmailWorker;
module.exports.createEmailWorker = createEmailWorker;
module.exports.default = defaultEmailWorker;
